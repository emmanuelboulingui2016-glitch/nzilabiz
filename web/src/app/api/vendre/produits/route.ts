// GET /api/vendre/produits — liste des produits (recherche/filtrage) + catégories dynamiques pour
// la grille de l'écran Vendre. Renvoie aussi la liste des clients de la boutique : l'écran Vendre a
// besoin d'un sélecteur client (obligatoire en cas de paiement Crédit) et le module Clients n'expose
// pas encore d'endpoint dédié dans ce périmètre — bundlé ici pour éviter de créer un fichier hors
// périmètre (§ voir résumé final).

import { NextResponse } from "next/server";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { categories, clients, products } from "@/db/schema";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!can(session.role, "vendre.use")) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const categoryId = searchParams.get("categoryId")?.trim();
  const codeBarres = searchParams.get("codeBarres")?.trim();

  const conditions = [eq(products.storeId, session.storeId)];
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (codeBarres) {
    conditions.push(eq(products.codeBarres, codeBarres));
  } else if (q) {
    const like = `%${q}%`;
    conditions.push(or(ilike(products.nom, like), ilike(products.reference, like), ilike(products.codeBarres, like))!);
  }

  const [productRows, categoryRows, clientRows] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.nom))
      .limit(300),
    db.query.categories.findMany({ where: eq(categories.storeId, session.storeId), orderBy: asc(categories.nom) }),
    db.query.clients.findMany({ where: eq(clients.storeId, session.storeId), orderBy: asc(clients.nom) }),
  ]);

  return NextResponse.json({
    products: productRows,
    categories: categoryRows,
    clients: clientRows,
  });
}
