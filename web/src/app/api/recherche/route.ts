// Recherche globale (champ de la barre du haut).
//
// Cherche en parallèle dans les produits, les clients et les ventes de la boutique, en respectant
// les permissions du rôle : un vendeur ne voit que ses propres ventes et n'a pas accès aux
// clients, donc ces sections n'apparaissent pas pour lui.

import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, products, sales } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

const LIMITE_PAR_SECTION = 5;

export type ResultatRecherche = {
  type: "produit" | "client" | "vente";
  id: string;
  titre: string;
  sousTitre: string;
  href: string;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ resultats: [] });

  const like = `%${q}%`;
  const resultats: ResultatRecherche[] = [];

  if (can(session.role, "stock.view")) {
    const rows = await db
      .select({
        id: products.id,
        nom: products.nom,
        reference: products.reference,
        quantiteStock: products.quantiteStock,
        prixVente: products.prixVente,
      })
      .from(products)
      .where(
        and(
          eq(products.storeId, session.storeId),
          or(ilike(products.nom, like), ilike(products.reference, like), ilike(products.codeBarres, like))
        )
      )
      .limit(LIMITE_PAR_SECTION);

    for (const p of rows) {
      resultats.push({
        type: "produit",
        id: p.id,
        titre: p.nom,
        sousTitre: `${p.reference} · ${Number(p.quantiteStock)} en stock · ${Math.round(Number(p.prixVente)).toLocaleString("fr-FR")} FCFA`,
        href: `/stock/${p.id}`,
      });
    }
  }

  if (can(session.role, "clients.view")) {
    const rows = await db
      .select({ id: clients.id, nom: clients.nom, telephone: clients.telephone, archive: clients.archive })
      .from(clients)
      .where(
        and(
          eq(clients.storeId, session.storeId),
          or(ilike(clients.nom, like), ilike(clients.telephone, like))
        )
      )
      .limit(LIMITE_PAR_SECTION);

    for (const c of rows) {
      resultats.push({
        type: "client",
        id: c.id,
        titre: c.nom,
        sousTitre: [c.telephone ?? "Sans téléphone", c.archive ? "archivé" : null].filter(Boolean).join(" · "),
        href: "/clients",
      });
    }
  }

  // Un vendeur ne consulte que ses propres ventes (§7) : on restreint la requête à son identifiant.
  const filtreVentes = can(session.role, "ventes.view.all")
    ? eq(sales.storeId, session.storeId)
    : and(eq(sales.storeId, session.storeId), eq(sales.userId, session.userId));

  const ventes = await db
    .select({
      id: sales.id,
      numero: sales.numero,
      total: sales.total,
      dateHeure: sales.dateHeure,
      statut: sales.statut,
    })
    .from(sales)
    .where(and(filtreVentes, sql`${sales.numero} ilike ${like}`))
    .orderBy(desc(sales.dateHeure))
    .limit(LIMITE_PAR_SECTION);

  for (const v of ventes) {
    resultats.push({
      type: "vente",
      id: v.id,
      titre: v.numero,
      sousTitre: `${v.dateHeure.toLocaleDateString("fr-FR")} · ${Math.round(Number(v.total)).toLocaleString("fr-FR")} FCFA${v.statut === "ANNULEE" ? " · annulée" : ""}`,
      href: "/ventes",
    });
  }

  return NextResponse.json({ resultats });
}
