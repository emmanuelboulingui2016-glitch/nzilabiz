// Chargement des fiches clients — source unique, partagée par la page serveur et par
// GET /api/clients. La page rend la liste déjà remplie : sans cela le navigateur devait la
// redemander aussitôt après affichage, soit un aller-retour de plus (environ 330 ms depuis une
// connexion gabonaise) pour des données que le serveur avait déjà sous la main.

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db/client";
import { clients, sales, payments, debtRepayments } from "@/db/schema";
import { frequenceAchatJours, segmentClient } from "@/lib/clients/loyalty";

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

export async function chargerClients(storeId: string) {

  const storeSalesFilter = and(
    eq(sales.storeId, storeId),
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

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas
  // la main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const allClients = await db.query.clients.findMany({
    where: eq(clients.storeId, storeId),
    orderBy: (c, { asc }) => [asc(c.nom)],
  });
  const achatsStats = await db
    .select({
      clientId: sales.clientId,
      nbAchats: sql<number>`count(*)::int`,
      totalAchats: sql<string>`coalesce(sum(${sales.total}), 0)`,
      premierAchat: sql<Date>`min(${sales.dateHeure})`,
      dernierAchat: sql<Date>`max(${sales.dateHeure})`,
    })
    .from(sales)
    .where(storeSalesFilter)
    .groupBy(sales.clientId);
  const creditStats = await db
    .select({
      clientId: sales.clientId,
      totalCredit: sql<string>`coalesce(sum(${sales.total}), 0)`,
    })
    .from(sales)
    .where(and(storeSalesFilter, inArray(sales.id, creditSaleIds)))
    .groupBy(sales.clientId);
  const remboursementsStats = await db
    .select({
      clientId: debtRepayments.clientId,
      totalRembourse: sql<string>`coalesce(sum(${debtRepayments.montant}), 0)`,
    })
    .from(debtRepayments)
    .innerJoin(clients, eq(clients.id, debtRepayments.clientId))
    .where(eq(clients.storeId, storeId))
    .groupBy(debtRepayments.clientId);


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

  return result;
}

export type FicheClient = Awaited<ReturnType<typeof chargerClients>>[number];
