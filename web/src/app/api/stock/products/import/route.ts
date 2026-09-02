// POST /api/stock/products/import — import CSV/Excel en masse (§8 🔧).
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
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { db } from "@/db/client";
import { categories, products } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { genProductRef } from "@/lib/utils";
import { CSV_FIELD_ALIASES, normalizeHeader } from "@/components/stock/stock-utils";
import { bloquerSiExpiree } from "@/lib/abonnement";

// Bornes de sécurité, dans le même esprit que src/lib/validation/fichier.ts pour les images : sans
// plafond, un classeur de plusieurs dizaines de milliers de lignes se lit intégralement et de façon
// synchrone en mémoire (SheetJS n'est pas streamé), ce qui gèle le serveur le temps de l'analyse et
// peut ensuite ouvrir une transaction DB interminable sur un pooler qui ne supporte déjà pas le
// parallélisme.
const TAILLE_MAX_OCTETS_IMPORT = 5_000_000; // 5 Mo bruts : large pour un catalogue boutique
const TAILLE_MAX_CARACTERES_BASE64 = Math.ceil((TAILLE_MAX_OCTETS_IMPORT * 4) / 3) + 1024; // le base64 pèse ~1/3 de plus que les octets d'origine
const LIGNES_MAX_IMPORT = 5_000;

const importSchema = z.object({
  nomFichier: z.string().min(1, "Nom de fichier manquant"),
  contenu: z
    .string()
    .min(1, "Le fichier est vide")
    .max(TAILLE_MAX_CARACTERES_BASE64, "Le fichier est trop volumineux (5 Mo maximum). Réduisez-le et réessayez."),
});

/**
 * Devine le format du fichier envoyé. Le contenu prime sur le nom : un classeur Excel est en
 * réalité une archive ZIP et commence toujours par la signature "PK", quelle que soit l'extension
 * déclarée. Le nom de fichier ne sert que de repli si le contenu est ambigu (fichier vide, etc.).
 */
function detecterFormat(nomFichier: string, buffer: Buffer): "xlsx" | "csv" {
  const estArchiveZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (estArchiveZip) return "xlsx";
  if (/\.xlsx$/i.test(nomFichier)) return "xlsx";
  return "csv";
}

/**
 * Étape de LECTURE, isolée de la VALIDATION métier : elle ne fait que transformer des octets bruts
 * en lignes { en-tête → valeur }, sans connaître les règles produit (champ obligatoire, prix,
 * doublon…). Ces règles restent entièrement dans la boucle d'import ci-dessous, inchangée quel que
 * soit le format d'origine du fichier.
 */
function lireLignes(format: "xlsx" | "csv", buffer: Buffer): Record<string, unknown>[] {
  if (format === "xlsx") {
    const classeur = XLSX.read(buffer, { type: "buffer" });
    const nomPremiereFeuille = classeur.SheetNames[0];
    if (!nomPremiereFeuille) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(classeur.Sheets[nomPremiereFeuille]);
  }
  const texte = buffer.toString("utf-8");
  const { data } = Papa.parse<Record<string, unknown>>(texte, { header: true, skipEmptyLines: true });
  return data;
}

function pickField(row: Record<string, unknown>, field: keyof typeof CSV_FIELD_ALIASES): string | undefined {
  const aliases = CSV_FIELD_ALIASES[field];
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeader(key);
    if (aliases.includes(normalized)) {
      const value = row[key];
      if (value === null || value === undefined) return undefined;
      const str = String(value).trim();
      return str.length > 0 ? str : undefined;
    }
  }
  return undefined;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? fallback : n;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nomFichier, contenu } = parsed.data;

  if (!/\.(csv|xlsx)$/i.test(nomFichier)) {
    return NextResponse.json({ error: "Format non reconnu : envoyez un fichier .csv ou .xlsx." }, { status: 400 });
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
    rows = lireLignes(format, buffer).filter((row) =>
      Object.values(row).some((v) => v !== undefined && v !== null && String(v).trim() !== ""),
    );
  } catch {
    return NextResponse.json(
      { error: "Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un CSV ou d'un classeur Excel (.xlsx) valide." },
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
