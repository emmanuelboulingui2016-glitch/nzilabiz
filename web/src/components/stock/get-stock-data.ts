// Chargement du stock — source unique, partagée par la page serveur et par GET /api/stock/products.
//
// La page rend désormais le tableau déjà rempli au lieu d'une coquille que le navigateur devait
// re-remplir aussitôt. Sur une connexion gabonaise, chaque aller-retour coûte environ 330 ms :
// afficher puis redemander, c'était doubler l'attente avant le premier chiffre à l'écran. La route
// API reste nécessaire pour les changements de filtre, qui n'ont pas à recharger la page.

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, expenses, products } from "@/db/schema";
import { computeStatut, toNumber, type CategoryRow, type ProductRow, type StockKpis } from "./stock-utils";

export type FiltresStock = { search?: string; categoryId?: string; status?: string };

export type DonneesStock = {
  products: ProductRow[];
  categories: CategoryRow[];
  kpis: StockKpis;
};

export async function chargerStock(storeId: string, filtres: FiltresStock = {}): Promise<DonneesStock> {
  const search = (filtres.search ?? "").trim().toLowerCase();
  const categoryId = filtres.categoryId ?? "";
  const status = filtres.status ?? "";

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas
  // la main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const allProducts = await db.query.products.findMany({
    where: eq(products.storeId, storeId),
    with: { category: true },
    orderBy: (p, { asc }) => [asc(p.nom)],
  });
  const categoriesList = await db.query.categories.findMany({
    where: eq(categories.storeId, storeId),
    orderBy: (c, { asc }) => [asc(c.nom)],
  });
  const aPayerRows = await db.query.expenses.findMany({
    where: and(
      eq(expenses.storeId, storeId),
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

  // Les indicateurs portent sur tout le catalogue, pas sur la sélection filtrée : « valeur du
  // stock » doit rester la valeur du stock, quel que soit le filtre affiché en dessous.
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

  return {
    products: filtered,
    categories: categoriesList.map((c) => ({ id: c.id, nom: c.nom })),
    kpis,
  };
}
