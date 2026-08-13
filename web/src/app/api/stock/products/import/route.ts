// POST /api/stock/products/import — import CSV/Excel en masse (§8 🔧).
//
// Le client lit et parse le fichier avec Papa.parse (header: true) puis poste ici les lignes
// brutes (en-têtes originaux). Cette route fait le mapping de colonnes tolérant, la création des
// catégories manquantes, la détection de doublons par code-barres (mise à jour si trouvé, sinon
// création) et l'insertion en masse avec référence générée.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, products } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { genProductRef } from "@/lib/utils";
import { CSV_FIELD_ALIASES, normalizeHeader } from "@/components/stock/stock-utils";

const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "Le fichier ne contient aucune ligne"),
});

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
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { rows } = parsed.data;

  const [existingProducts, existingCategories] = await Promise.all([
    db.query.products.findMany({ where: eq(products.storeId, session.storeId) }),
    db.query.categories.findMany({ where: eq(categories.storeId, session.storeId) }),
  ]);

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
