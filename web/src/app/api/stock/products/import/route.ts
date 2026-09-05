// GET  /api/stock/products/import — télécharge le classeur modèle
// POST /api/stock/products/import — import de produits en masse depuis un classeur Excel (§8).
//
// Le client envoie le fichier brut (encodé en base64, comme les photos de produit ailleurs dans
// l'app) plutôt que des lignes déjà parsées : c'est cette route, et elle seule, qui sait lire un
// CSV ou un classeur Excel — le navigateur n'a plus besoin d'embarquer de logique de lecture par
// format. Une fois les lignes obtenues (§ « lecture »), le reste est strictement identique à
// l'ancien flux CSV : mapping de colonnes tolérant, création des catégories manquantes, détection
// de doublons par code-barres (mise à jour si trouvé, sinon création) et insertion en masse avec
// référence générée (§ « validation / écriture »).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as XLSX from "xlsx";
import { db } from "@/db/client";
import { categories, products } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { genProductRef } from "@/lib/utils";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { detecterFormat, ligneExploitable, lireLignes, parseNumber, pickField } from "@/lib/stock-import";

// Bornes de sécurité, dans le même esprit que src/lib/validation/fichier.ts pour les images : sans
// plafond, un classeur de plusieurs dizaines de milliers de lignes se lit intégralement et de façon
// synchrone en mémoire (SheetJS n'est pas streamé), ce qui gèle le serveur le temps de l'analyse et
// peut ensuite ouvrir une transaction DB interminable sur un pooler qui ne supporte déjà pas le
// parallélisme.
const TAILLE_MAX_OCTETS_IMPORT = 5_000_000; // 5 Mo bruts : large pour un catalogue boutique
const TAILLE_MAX_CARACTERES_BASE64 = Math.ceil((TAILLE_MAX_OCTETS_IMPORT * 4) / 3) + 1024; // le base64 pèse ~1/3 de plus que les octets d'origine
const LIGNES_MAX_IMPORT = 5_000;

// Filet de sécurité côté plateforme (Vercel) en plus des bornes ci-dessus : même si un classeur
// hostile faisait traîner le parsing XLSX, l'exécution de la requête est de toute façon coupée
// après ce délai plutôt que de consommer indéfiniment un temps de fonction serverless.
export const maxDuration = 15;

const importSchema = z.object({
  nomFichier: z.string().min(1, "Nom de fichier manquant"),
  contenu: z
    .string()
    .min(1, "Le fichier est vide")
    .max(TAILLE_MAX_CARACTERES_BASE64, "Le fichier est trop volumineux (5 Mo maximum). Réduisez-le et réessayez."),
});

/**
 * Modèle à remplir, servi en .xlsx.
 *
 * Il était auparavant fabriqué dans le navigateur sous forme de CSV. Le proposer en CSV alors que
 * l'import n'accepte plus que l'Excel envoyait le commerçant dans le mur : il téléchargeait un
 * modèle, le remplissait, et se faisait refuser son fichier.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(session, "stock.edit"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const feuille = XLSX.utils.aoa_to_sheet([
    ["nom", "categorie", "codeBarres", "prixAchat", "prixVente", "unite", "quantiteStock", "seuilAlerte"],
    ["Riz 5kg", "Alimentation", "1234567890123", 4500, 5500, "unité", 20, 5],
  ]);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Produits");
  const octets = XLSX.write(classeur, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return new NextResponse(new Uint8Array(octets), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="modele-produits.xlsx"',
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "stock.edit"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nomFichier, contenu } = parsed.data;

  // Excel seulement. Le CSV a été retiré à la demande du commerçant : deux formats acceptés
  // voulaient dire deux modèles à maintenir, deux façons d'échouer, et un tableur mal exporté en
  // CSV (séparateurs, accents, points-virgules) produisait des erreurs incompréhensibles.
  if (!/\.xlsx$/i.test(nomFichier)) {
    return NextResponse.json(
      { error: "Format non reconnu : envoyez un classeur Excel (.xlsx)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(contenu, "base64");
  // Le contrôle sur la chaîne base64 (schéma ci-dessus) borne déjà la taille, mais on revérifie ici
  // sur les octets décodés : défense en profondeur si le padding base64 faisait dévier l'estimation.
  if (buffer.byteLength > TAILLE_MAX_OCTETS_IMPORT) {
    return NextResponse.json({ error: "Le fichier est trop volumineux (5 Mo maximum). Réduisez-le et réessayez." }, { status: 400 });
  }

  const format = detecterFormat(nomFichier, buffer);

  let rows: Record<string, unknown>[];
  try {
    // +2 : la ligne d'en-tête, puis une ligne de plus que la borne autorisée pour pouvoir encore
    // distinguer « fichier trop long » d'un fichier tenant tout juste dans la limite, sans jamais
    // demander à SheetJS de parser au-delà de ce dont on a besoin.
    rows = lireLignes(format, buffer, LIGNES_MAX_IMPORT + 2).filter(ligneExploitable);
  } catch {
    return NextResponse.json(
      { error: "Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un classeur Excel (.xlsx) valide." },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Le fichier ne contient aucune ligne exploitable." }, { status: 400 });
  }
  if (rows.length > LIGNES_MAX_IMPORT) {
    return NextResponse.json(
      { error: `Le fichier contient trop de lignes (${LIGNES_MAX_IMPORT} maximum). Scindez-le en plusieurs imports.` },
      { status: 400 },
    );
  }

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas
  // la main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const existingProducts = await db.query.products.findMany({ where: eq(products.storeId, session.storeId) });
  const existingCategories = await db.query.categories.findMany({ where: eq(categories.storeId, session.storeId) });


  const byBarcode = new Map(existingProducts.filter((p) => p.codeBarres).map((p) => [p.codeBarres as string, p]));
  const categoryCache = new Map(existingCategories.map((c) => [c.nom.toLowerCase(), c.id]));
  const usedReferences = new Set(existingProducts.map((p) => p.reference));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      const rowNum = i + 2; // +1 pour l'index base 1, +1 pour la ligne d'en-tête

      const nom = pickField(row, "nom");
      if (!nom) {
        skipped++;
        errors.push(`Ligne ${rowNum} : nom manquant, ignorée.`);
        continue;
      }

      const prixAchat = parseNumber(pickField(row, "prixAchat"), NaN);
      const prixVente = parseNumber(pickField(row, "prixVente"), NaN);
      if (Number.isNaN(prixAchat) || Number.isNaN(prixVente)) {
        skipped++;
        errors.push(`Ligne ${rowNum} (${nom}) : prix d'achat ou de vente invalide, ignorée.`);
        continue;
      }

      const codeBarres = pickField(row, "codeBarres") ?? null;
      const categorieNom = pickField(row, "categorie");
      const unite = pickField(row, "unite") ?? "unité";
      const quantiteStock = parseNumber(pickField(row, "quantiteStock"), 0);
      const seuilAlerte = parseNumber(pickField(row, "seuilAlerte"), 5);
      const prixGros = pickField(row, "prixGros");

      let categoryId: string | null = null;
      if (categorieNom) {
        const key = categorieNom.toLowerCase();
        const cachedId = categoryCache.get(key);
        if (cachedId) {
          categoryId = cachedId;
        } else {
          const [cat] = await tx.insert(categories).values({ storeId: session.storeId, nom: categorieNom }).returning();
          categoryCache.set(key, cat.id);
          categoryId = cat.id;
        }
      }

      const existingByBarcode = codeBarres ? byBarcode.get(codeBarres) : undefined;

      if (existingByBarcode) {
        // Doublon détecté par code-barres au sein de la boutique : on met à jour le produit existant.
        await tx
          .update(products)
          .set({
            nom,
            categoryId: categoryId ?? existingByBarcode.categoryId,
            prixAchat: String(prixAchat),
            prixVente: String(prixVente),
            prixGros: prixGros !== undefined ? String(parseNumber(prixGros, 0)) : existingByBarcode.prixGros,
            unite,
            quantiteStock: String(quantiteStock),
            seuilAlerte: String(seuilAlerte),
            misAJourLe: new Date(),
          })
          .where(eq(products.id, existingByBarcode.id));
        updated++;
        continue;
      }

      let reference = genProductRef();
      let attempts = 0;
      while (usedReferences.has(reference) && attempts < 10) {
        reference = genProductRef();
        attempts++;
      }
      usedReferences.add(reference);

      try {
        const [inserted] = await tx
          .insert(products)
          .values({
            storeId: session.storeId,
            reference,
            nom,
            categoryId,
            codeBarres,
            prixAchat: String(prixAchat),
            prixVente: String(prixVente),
            prixGros: prixGros !== undefined ? String(parseNumber(prixGros, 0)) : null,
            unite,
            quantiteStock: String(quantiteStock),
            seuilAlerte: String(seuilAlerte),
          })
          .returning();
        if (codeBarres) byBarcode.set(codeBarres, inserted);
        created++;
      } catch {
        skipped++;
        errors.push(`Ligne ${rowNum} (${nom}) : échec d'insertion (code-barres en doublon ?).`);
      }
    }
  });

  return NextResponse.json({ created, updated, skipped, errors });
}
