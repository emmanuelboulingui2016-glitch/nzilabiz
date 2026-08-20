// GET  /api/stock/products?q=&categoryId=&status=  — liste filtrée + KPI (§8)
// POST /api/stock/products                          — création produit (catégorie créable à la volée)

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, expenses, products, stockMovements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { genProductRef } from "@/lib/utils";
import { computeStatut, toNumber, type ProductRow, type CategoryRow, type StockKpis } from "@/components/stock/stock-utils";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "stock.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("q") ?? "").trim().toLowerCase();
  const categoryId = searchParams.get("categoryId") ?? "";
  const status = searchParams.get("status") ?? "";

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas
  // la main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const allProducts = await db.query.products.findMany({
    where: eq(products.storeId, session.storeId),
    with: { category: true },
    orderBy: (p, { asc }) => [asc(p.nom)],
  });
  const categoriesList = await db.query.categories.findMany({
    where: eq(categories.storeId, session.storeId),
    orderBy: (c, { asc }) => [asc(c.nom)],
  });
  const aPayerRows = await db.query.expenses.findMany({
    where: and(
      eq(expenses.storeId, session.storeId),
      eq(expenses.categorie, "Rachats de stock"),
      eq(expenses.modeReglement, "CREDIT")
    ),
    columns: { montant: true },
  });


  const rows: ProductRow[] = allProducts.map((p) => ({
    id: p.id,
    reference: p.reference,
    nom: p.nom,
    photoUrl: p.photoUrl,
    categoryId: p.categoryId,
    categoryNom: p.category?.nom ?? null,
    codeBarres: p.codeBarres,
    datePeremption: p.datePeremption ? p.datePeremption.toISOString() : null,
    prixAchat: p.prixAchat,
    prixVente: p.prixVente,
    prixGros: p.prixGros,
    unite: p.unite,
    quantiteStock: p.quantiteStock,
    seuilAlerte: p.seuilAlerte,
    statut: computeStatut(toNumber(p.quantiteStock), toNumber(p.seuilAlerte)),
    creeLe: p.creeLe.toISOString(),
  }));

  const kpis: StockKpis = {
    totalProduits: rows.length,
    valeurStock: rows.reduce((sum, p) => sum + toNumber(p.quantiteStock) * toNumber(p.prixAchat), 0),
    stockFaible: rows.filter((p) => p.statut === "faible").length,
    ruptureStock: rows.filter((p) => p.statut === "rupture").length,
    aPayer: aPayerRows.reduce((sum, r) => sum + toNumber(r.montant), 0),
  };

  let filtered = rows;
  if (categoryId) filtered = filtered.filter((p) => p.categoryId === categoryId);
  if (status) filtered = filtered.filter((p) => p.statut === status);
  if (search) {
    filtered = filtered.filter(
      (p) =>
        p.nom.toLowerCase().includes(search) ||
        p.reference.toLowerCase().includes(search) ||
        (p.codeBarres ?? "").toLowerCase().includes(search)
    );
  }

  const categoriesOut: CategoryRow[] = categoriesList.map((c) => ({ id: c.id, nom: c.nom }));

  return NextResponse.json({ products: filtered, categories: categoriesOut, kpis });
}

const createProductSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  categoryId: z.string().optional().nullable(),
  categoryNom: z.string().optional().nullable(),
  codeBarres: z.string().optional().nullable(),
  datePeremption: z.string().optional().nullable(),
  prixAchat: z.coerce.number().min(0),
  prixVente: z.coerce.number().min(0),
  prixGros: z.coerce.number().min(0).optional().nullable(),
  unite: z.string().min(1).default("unité"),
  quantiteInitiale: z.coerce.number().min(0).default(0),
  seuilAlerte: z.coerce.number().min(0).default(5),
  photoUrl: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  let categoryId = data.categoryId || null;
  if (!categoryId && data.categoryNom?.trim()) {
    const nom = data.categoryNom.trim();
    const existing = await db.query.categories.findFirst({
      where: and(eq(categories.storeId, session.storeId), eq(categories.nom, nom)),
    });
    if (existing) {
      categoryId = existing.id;
    } else {
      const [created] = await db.insert(categories).values({ storeId: session.storeId, nom }).returning();
      categoryId = created.id;
    }
  }

  let product: typeof products.$inferSelect | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    const reference = genProductRef();
    try {
      const [created] = await db
        .insert(products)
        .values({
          storeId: session.storeId,
          reference,
          nom: data.nom,
          photoUrl: data.photoUrl || null,
          categoryId,
          codeBarres: data.codeBarres || null,
          datePeremption: data.datePeremption ? new Date(data.datePeremption) : null,
          prixAchat: String(data.prixAchat),
          prixVente: String(data.prixVente),
          prixGros: data.prixGros != null ? String(data.prixGros) : null,
          unite: data.unite,
          quantiteStock: String(data.quantiteInitiale),
          seuilAlerte: String(data.seuilAlerte),
        })
        .returning();
      product = created;
      break;
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505" && attempt < 5) continue; // collision référence unique — on réessaie
      throw err;
    }
  }

  if (!product) {
    return NextResponse.json({ error: "Impossible de générer une référence unique, réessayez." }, { status: 500 });
  }

  if (data.quantiteInitiale > 0) {
    await db.insert(stockMovements).values({
      productId: product.id,
      type: "AJUSTEMENT",
      quantite: String(data.quantiteInitiale),
      motif: "Stock initial (création produit)",
      userId: session.userId,
    });
  }

  return NextResponse.json({ product }, { status: 201 });
}
