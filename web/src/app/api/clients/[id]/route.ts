// Module Clients — fiche d'un client.
//
// GET   : informations de contact, statistiques de fidélité, produits préférés et historique
//         complet des achats (toutes ventes VALIDEE à son nom, pas seulement celles à crédit —
//         c'est la différence avec la fiche du module Créances).
// PATCH : mise à jour de la fiche, y compris l'archivage (`archive: true`). Il n'y a pas de
//         DELETE : un client est référencé par ses ventes passées, le supprimer casserait
//         l'historique et les rapports.

import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db/client";
import { clients, sales, saleItems, products, payments, debtRepayments } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { frequenceAchatJours, segmentClient } from "@/lib/clients/loyalty";
import { bloquerSiExpiree } from "@/lib/abonnement";

const MAX_HISTORIQUE = 50;
const MAX_TOP_PRODUITS = 5;

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "clients.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.storeId, session.storeId)),
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const clientSalesFilter = and(
    eq(sales.storeId, session.storeId),
    eq(sales.statut, "VALIDEE"),
    eq(sales.clientId, id)
  );

  const creditSaleIds = db
    .select({ saleId: payments.saleId })
    .from(payments)
    .where(eq(payments.mode, "CREDIT"));

  const [historique, topProduits, aggRows, creditRows, remboursementRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        numero: sales.numero,
        dateHeure: sales.dateHeure,
        total: sales.total,
      })
      .from(sales)
      .where(clientSalesFilter)
      .orderBy(desc(sales.dateHeure))
      .limit(MAX_HISTORIQUE),
    db
      .select({
        productId: saleItems.productId,
        nom: products.nom,
        quantite: sql<string>`coalesce(sum(${saleItems.quantite}), 0)`,
        montant: sql<string>`coalesce(sum(${saleItems.sousTotal}), 0)`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(clientSalesFilter)
      .groupBy(saleItems.productId, products.nom)
      .orderBy(sql`sum(${saleItems.sousTotal}) desc`)
      .limit(MAX_TOP_PRODUITS),
    db
      .select({
        nbAchats: sql<number>`count(*)::int`,
        totalAchats: sql<string>`coalesce(sum(${sales.total}), 0)`,
        premierAchat: sql<Date>`min(${sales.dateHeure})`,
        dernierAchat: sql<Date>`max(${sales.dateHeure})`,
      })
      .from(sales)
      .where(clientSalesFilter),
    db
      .select({ totalCredit: sql<string>`coalesce(sum(${sales.total}), 0)` })
      .from(sales)
      .where(and(clientSalesFilter, inArray(sales.id, creditSaleIds))),
    db
      .select({ totalRembourse: sql<string>`coalesce(sum(${debtRepayments.montant}), 0)` })
      .from(debtRepayments)
      .where(eq(debtRepayments.clientId, id)),
  ]);

  const agg = aggRows[0];
  const nbAchats = agg?.nbAchats ?? 0;
  const totalAchats = n(agg?.totalAchats);
  const premierAchat = agg?.premierAchat ? new Date(agg.premierAchat) : null;
  const dernierAchat = agg?.dernierAchat ? new Date(agg.dernierAchat) : null;
  const today = new Date();
  const joursDepuisDernierAchat = dernierAchat ? differenceInCalendarDays(today, dernierAchat) : null;
  const joursDepuisPremierAchat = premierAchat ? differenceInCalendarDays(today, premierAchat) : null;
  const soldeCreance = n(creditRows[0]?.totalCredit) - n(remboursementRows[0]?.totalRembourse);

  return NextResponse.json({
    client: {
      id: client.id,
      nom: client.nom,
      telephone: client.telephone,
      email: client.email,
      adresse: client.adresse,
      notes: client.notes,
      archive: client.archive,
      limiteCredit: client.limiteCredit !== null ? n(client.limiteCredit) : null,
      echeanceJours: client.echeanceJours,
      creeLe: client.creeLe.toISOString(),
      nbAchats,
      totalAchats,
      panierMoyen: nbAchats > 0 ? Math.round(totalAchats / nbAchats) : 0,
      premierAchat: premierAchat?.toISOString() ?? null,
      dernierAchat: dernierAchat?.toISOString() ?? null,
      joursDepuisDernierAchat,
      frequenceJours: frequenceAchatJours({ nbAchats, premierAchat, dernierAchat }),
      soldeCreance: soldeCreance > 0 ? soldeCreance : 0,
      segment: segmentClient({ nbAchats, joursDepuisDernierAchat, joursDepuisPremierAchat }),
    },
    historique: historique.map((s) => ({
      id: s.id,
      numero: s.numero,
      dateHeure: s.dateHeure.toISOString(),
      total: n(s.total),
    })),
    topProduits: topProduits.map((p) => ({
      productId: p.productId,
      nom: p.nom,
      quantite: n(p.quantite),
      montant: n(p.montant),
    })),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "clients.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.storeId, session.storeId)),
  });
  if (!existing) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const optionalText = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const updates: Partial<typeof clients.$inferInsert> = {};
  if (typeof body.nom === "string" && body.nom.trim()) updates.nom = body.nom.trim();
  if ("telephone" in body) updates.telephone = optionalText(body.telephone);
  if ("email" in body) updates.email = optionalText(body.email);
  if ("adresse" in body) updates.adresse = optionalText(body.adresse);
  if ("notes" in body) updates.notes = optionalText(body.notes);
  if ("archive" in body) updates.archive = Boolean(body.archive);
  if ("limiteCredit" in body) {
    updates.limiteCredit =
      body.limiteCredit === null || body.limiteCredit === "" || body.limiteCredit === undefined
        ? null
        : String(body.limiteCredit);
  }
  if ("echeanceJours" in body) {
    updates.echeanceJours =
      body.echeanceJours === null || body.echeanceJours === "" || body.echeanceJours === undefined
        ? null
        : Number(body.echeanceJours);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const [updated] = await db.update(clients).set(updates).where(eq(clients.id, id)).returning();
  return NextResponse.json({ client: updated });
}
