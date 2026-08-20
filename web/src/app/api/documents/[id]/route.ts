// GET /api/documents/[id] — détail complet d'un document, pour l'impression/l'aperçu et pour l'étape
// de conversion Proforma → Vente. Résout le client (réel ou nom libre), la vente liée avec ses
// lignes (si Facture générée depuis une vente), les lignes brouillon (si Proforma), et — uniquement
// pour une Proforma encore en BROUILLON — la liste des produits du catalogue de la boutique afin que
// l'écran de conversion puisse proposer l'association de chaque ligne brouillon à un vrai Product.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, documents, products, saleItems, sales, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import type { DraftItem } from "@/components/documents/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "documents.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.storeId, session.storeId)),
  });
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas
  // la main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const client = doc.clientId
    ? await db.query.clients.findFirst({ where: eq(clients.id, doc.clientId) })
    : null;
  const seller = await db.query.users.findFirst({ where: eq(users.id, doc.userId) });


  let sale: { id: string; numero: string; dateHeure: string; total: number; items: unknown[] } | null = null;
  if (doc.saleId) {
    const saleRow = await db.query.sales.findFirst({ where: eq(sales.id, doc.saleId) });
    if (saleRow) {
      const items = await db
        .select({
          id: saleItems.id,
          productNom: products.nom,
          quantite: saleItems.quantite,
          prixUnitaire: saleItems.prixUnitaire,
          sousTotal: saleItems.sousTotal,
        })
        .from(saleItems)
        .leftJoin(products, eq(saleItems.productId, products.id))
        .where(eq(saleItems.saleId, saleRow.id));

      sale = {
        id: saleRow.id,
        numero: saleRow.numero,
        dateHeure: saleRow.dateHeure.toISOString(),
        total: Number(saleRow.total),
        items: items.map((i) => ({
          id: i.id,
          productNom: i.productNom ?? "—",
          quantite: Number(i.quantite),
          prixUnitaire: Number(i.prixUnitaire),
          sousTotal: Number(i.sousTotal),
        })),
      };
    }
  }

  let itemsBrouillon: DraftItem[] | null = null;
  if (doc.itemsBrouillon) {
    try {
      itemsBrouillon = JSON.parse(doc.itemsBrouillon);
    } catch {
      itemsBrouillon = null;
    }
  }

  let produitsDisponibles: { id: string; nom: string; prixVente: number }[] | undefined;
  if (doc.type === "PROFORMA" && doc.statut === "BROUILLON") {
    const rows = await db.query.products.findMany({
      where: eq(products.storeId, session.storeId),
      orderBy: (p, { asc }) => [asc(p.nom)],
    });
    produitsDisponibles = rows.map((p) => ({ id: p.id, nom: p.nom, prixVente: Number(p.prixVente) }));
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      type: doc.type,
      numero: doc.numero,
      statut: doc.statut,
      date: doc.date.toISOString(),
      montantTotal: Number(doc.montantTotal),
      clientId: doc.clientId,
      clientNom: client?.nom ?? null,
      clientTelephone: client?.telephone ?? null,
      clientNomLibre: doc.clientNomLibre,
      saleId: doc.saleId,
      convertieEnVenteId: doc.convertieEnVenteId,
      itemsBrouillon,
      vendeurNom: seller?.nom ?? null,
    },
    sale,
    produitsDisponibles,
  });
}
