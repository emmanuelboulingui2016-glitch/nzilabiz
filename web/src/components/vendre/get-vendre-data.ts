// Chargement de l'écran de caisse — source unique, partagée par la page serveur et par
// GET /api/vendre/produits.
//
// C'est l'écran le plus utilisé de l'application : un vendeur l'ouvre des dizaines de fois par jour.
// Il ne doit rien attendre. La page rend donc la grille déjà remplie, au lieu d'afficher une grille
// vide puis d'attendre 250 ms avant même de demander les produits au serveur.

import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, clients, products } from "@/db/schema";

export type FiltresVendre = { q?: string | null; categoryId?: string | null; codeBarres?: string | null };

export async function chargerVendre(storeId: string, filtres: FiltresVendre = {}) {
  const q = filtres.q?.trim() ?? "";
  const categoryId = filtres.categoryId?.trim();
  const codeBarres = filtres.codeBarres?.trim();

  const conditions: SQL[] = [eq(products.storeId, storeId)];
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (codeBarres) {
    conditions.push(eq(products.codeBarres, codeBarres));
  } else if (q) {
    const like = `%${q}%`;
    conditions.push(or(ilike(products.nom, like), ilike(products.reference, like), ilike(products.codeBarres, like))!);
  }

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas la
  // main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const productRows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.nom))
    .limit(300);

  const categoryRows = await db.query.categories.findMany({
    where: eq(categories.storeId, storeId),
    orderBy: asc(categories.nom),
  });

  // Les clients archivés (module Clients) restent hors du sélecteur de caisse : on n'ouvre plus
  // de nouvelle vente à leur nom. Leur historique et leurs créances restent intacts.
  const clientRows = await db.query.clients.findMany({
    where: and(eq(clients.storeId, storeId), eq(clients.archive, false)),
    orderBy: asc(clients.nom),
  });

  return { products: productRows, categories: categoryRows, clients: clientRows };
}

export type DonneesVendre = Awaited<ReturnType<typeof chargerVendre>>;
