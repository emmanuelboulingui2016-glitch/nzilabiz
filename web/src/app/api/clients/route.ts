// Module Clients — gestion de la clientèle (fiches, fidélité, relances).
//
// GET  : liste des clients de la boutique enrichie des statistiques d'achat calculées en SQL
//        (nombre d'achats, chiffre d'affaires, panier moyen, premier/dernier achat), du solde
//        de créance, et du segment de fidélité déduit de ces chiffres (voir lib/clients/loyalty).
// POST : création d'une fiche client.
//
// Ce module partage la table `clients` avec le module Créances (§9) : un client créé ici est
// immédiatement sélectionnable en caisse et dans les créances, et inversement.

import { NextResponse } from "next/server";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db/client";
import { clients, sales, payments, debtRepayments } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { frequenceAchatJours, segmentClient } from "@/lib/clients/loyalty";

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "clients.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const storeSalesFilter = and(
    eq(sales.storeId, session.storeId),
    eq(sales.statut, "VALIDEE"),
    isNotNull(sales.clientId)
  );

  // Ventes à crédit = ventes ayant au moins un règlement en mode CREDIT. Passer par une
  // sous-requête plutôt qu'une jointure évite de compter deux fois une vente qui aurait
  // plusieurs lignes de règlement.
  const creditSaleIds = db
    .select({ saleId: payments.saleId })
    .from(payments)
    .where(eq(payments.mode, "CREDIT"));

  const [allClients, achatsStats, creditStats, remboursementsStats] = await Promise.all([
    db.query.clients.findMany({
      where: eq(clients.storeId, session.storeId),
      orderBy: (c, { asc }) => [asc(c.nom)],
    }),
    db
      .select({
        clientId: sales.clientId,
        nbAchats: sql<number>`count(*)::int`,
        totalAchats: sql<string>`coalesce(sum(${sales.total}), 0)`,
        premierAchat: sql<Date>`min(${sales.dateHeure})`,
        dernierAchat: sql<Date>`max(${sales.dateHeure})`,
      })
      .from(sales)
      .where(storeSalesFilter)
      .groupBy(sales.clientId),
    db
      .select({
        clientId: sales.clientId,
        totalCredit: sql<string>`coalesce(sum(${sales.total}), 0)`,
      })
      .from(sales)
      .where(and(storeSalesFilter, inArray(sales.id, creditSaleIds)))
      .groupBy(sales.clientId),
    db
      .select({
        clientId: debtRepayments.clientId,
        totalRembourse: sql<string>`coalesce(sum(${debtRepayments.montant}), 0)`,
      })
      .from(debtRepayments)
      .innerJoin(clients, eq(clients.id, debtRepayments.clientId))
      .where(eq(clients.storeId, session.storeId))
      .groupBy(debtRepayments.clientId),
  ]);

  const achatsById = new Map(achatsStats.map((r) => [r.clientId, r]));
  const creditById = new Map(creditStats.map((r) => [r.clientId, n(r.totalCredit)]));
  const remboursesById = new Map(remboursementsStats.map((r) => [r.clientId, n(r.totalRembourse)]));

  const today = new Date();

  const result = allClients.map((client) => {
    const stats = achatsById.get(client.id);
    const nbAchats = stats?.nbAchats ?? 0;
    const totalAchats = n(stats?.totalAchats);
    const premierAchat = stats?.premierAchat ? new Date(stats.premierAchat) : null;
    const dernierAchat = stats?.dernierAchat ? new Date(stats.dernierAchat) : null;

    const joursDepuisDernierAchat = dernierAchat ? differenceInCalendarDays(today, dernierAchat) : null;
    const joursDepuisPremierAchat = premierAchat ? differenceInCalendarDays(today, premierAchat) : null;

    const soldeCreance = (creditById.get(client.id) ?? 0) - (remboursesById.get(client.id) ?? 0);

    return {
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
    };
  });

  return NextResponse.json({ clients: result });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "clients.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.nom !== "string" || !body.nom.trim()) {
    return NextResponse.json({ error: "Le nom du client est requis" }, { status: 400 });
  }

  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const [created] = await db
    .insert(clients)
    .values({
      storeId: session.storeId,
      nom: body.nom.trim(),
      telephone: text(body.telephone),
      email: text(body.email),
      adresse: text(body.adresse),
      notes: text(body.notes),
      limiteCredit:
        body.limiteCredit === null || body.limiteCredit === undefined || body.limiteCredit === ""
          ? null
          : String(body.limiteCredit),
      echeanceJours:
        body.echeanceJours === null || body.echeanceJours === undefined || body.echeanceJours === ""
          ? null
          : Number(body.echeanceJours),
    })
    .returning();

  return NextResponse.json({ client: created }, { status: 201 });
}
