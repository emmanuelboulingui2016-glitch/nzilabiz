// GET  /api/ventes/approbations — liste les demandes d'annulation de vente en attente pour cette
//      boutique (réservé aux utilisateurs avec la permission approbations.decider).
// POST /api/ventes/approbations — approuve ou rejette une demande. L'approbation applique les mêmes
//      effets que l'annulation directe (réajustement de stock + StockMovement).

import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRequests, products, sales, stockMovements, users } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { bloquerSiExpiree } from "@/lib/abonnement";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!(await peut(session, "approbations.decider"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const pending = await db.query.approvalRequests.findMany({
    where: and(
      eq(approvalRequests.storeId, session.storeId),
      eq(approvalRequests.type, "ANNULATION_VENTE"),
      eq(approvalRequests.statut, "EN_ATTENTE")
    ),
    orderBy: desc(approvalRequests.creeLe),
  });

  const saleIds = [...new Set(pending.map((r) => r.refId))];
  const requesterIds = [...new Set(pending.map((r) => r.demandeParId))];

  const [relatedSales, requesters] = await Promise.all([
    saleIds.length
      ? db.query.sales.findMany({ where: and(eq(sales.storeId, session.storeId), inArray(sales.id, saleIds)) })
      : Promise.resolve([]),
    requesterIds.length ? db.query.users.findMany({ where: inArray(users.id, requesterIds) }) : Promise.resolve([]),
  ]);

  const saleMap = new Map(relatedSales.map((s) => [s.id, s]));
  const userMap = new Map(requesters.map((u) => [u.id, u]));

  const result = pending.map((r) => {
    const sale = saleMap.get(r.refId);
    return {
      id: r.id,
      motif: r.motif,
      creeLe: r.creeLe,
      demandeParNom: userMap.get(r.demandeParId)?.nom ?? "—",
      sale: sale ? { id: sale.id, numero: sale.numero, total: sale.total, dateHeure: sale.dateHeure } : null,
    };
  });

  return NextResponse.json({ requests: result });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "approbations.decider"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = typeof body?.requestId === "string" ? body.requestId : null;
  const decision = body?.decision === "APPROUVER" || body?.decision === "REJETER" ? body.decision : null;
  if (!requestId || !decision) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const reqRow = await db.query.approvalRequests.findFirst({
    where: and(eq(approvalRequests.id, requestId), eq(approvalRequests.storeId, session.storeId)),
  });
  if (!reqRow) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  if (reqRow.statut !== "EN_ATTENTE") {
    return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 400 });
  }

  // Personne ne tranche sa propre demande, sauf le patron — qui pouvait de toute façon annuler
  // directement, sans passer par ce circuit. Le rôle GERANT détient à la fois le droit de demander
  // et celui de décider : sans cette règle, il lui suffisait de deux clics pour annuler une vente,
  // et le circuit d'approbation ne contrôlait plus rien pour lui.
  if (reqRow.demandeParId === session.userId && session.role !== "PATRON") {
    return NextResponse.json(
      { error: "Vous ne pouvez pas approuver votre propre demande. Le patron doit la valider." },
      { status: 403 }
    );
  }

  if (decision === "REJETER") {
    await db
      .update(approvalRequests)
      .set({ statut: "REJETEE", decideParId: session.userId, decideLe: new Date() })
      .where(eq(approvalRequests.id, reqRow.id));
    return NextResponse.json({ ok: true, mode: "rejetee" as const });
  }

  // APPROUVER : applique l'annulation de la vente référencée + réajustement de stock.
  const sale = await db.query.sales.findFirst({
    where: and(eq(sales.id, reqRow.refId), eq(sales.storeId, session.storeId)),
    with: { items: true },
  });
  if (!sale) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });

  if (sale.statut === "ANNULEE") {
    // Déjà annulée entre-temps (ex. annulation directe par le Patron) : on clôture juste la demande.
    await db
      .update(approvalRequests)
      .set({ statut: "APPROUVEE", decideParId: session.userId, decideLe: new Date() })
      .where(eq(approvalRequests.id, reqRow.id));
    return NextResponse.json({ ok: true, mode: "deja_annulee" as const });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sales)
      .set({
        statut: "ANNULEE",
        motifAnnulation: reqRow.motif,
        annuleLe: new Date(),
        approuveParId: session.userId,
      })
      .where(eq(sales.id, sale.id));

    for (const item of sale.items) {
      await tx
        .update(products)
        .set({
          quantiteStock: sql`${products.quantiteStock} + ${item.quantite}`,
          misAJourLe: new Date(),
        })
        .where(eq(products.id, item.productId));

      await tx.insert(stockMovements).values({
        productId: item.productId,
        type: "ANNULATION",
        quantite: item.quantite,
        motif: reqRow.motif,
        userId: session.userId,
        saleId: sale.id,
      });
    }

    await tx
      .update(approvalRequests)
      .set({ statut: "APPROUVEE", decideParId: session.userId, decideLe: new Date() })
      .where(eq(approvalRequests.id, reqRow.id));
  });

  return NextResponse.json({ ok: true, mode: "approuvee" as const });
}
