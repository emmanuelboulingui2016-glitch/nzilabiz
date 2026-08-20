// Calcul des créances clients — source unique de vérité.
//
// Extrait de la route GET /api/creances/clients pour être réutilisé par le centre de
// notifications : deux calculs de retard qui divergent, c'est un écran qui alerte et un autre qui
// dit que tout va bien.
//
// Règle (§9 du cahier des charges) : le solde d'un client est la somme des ventes VALIDEE ayant
// au moins un règlement en mode CREDIT, moins ses remboursements. Les remboursements s'imputent
// FIFO sur les ventes les plus anciennes ; la première vente encore impayée détermine l'échéance
// et donc les jours de retard.

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db/client";
import { clients, sales, payments, debtRepayments, notificationSettings } from "@/db/schema";

export const DEFAULT_ECHEANCE_JOURS = 30;

export type CreanceClient = {
  id: string;
  nom: string;
  telephone: string | null;
  archive: boolean;
  limiteCredit: number | null;
  echeanceJours: number | null;
  echeanceEffective: number;
  solde: number;
  totalCredit: number;
  totalRembourse: number;
  dateEcheance: string | null;
  joursRetard: number | null;
  depassementLimite: boolean;
  creeLe: string;
};

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

export async function chargerCreances(storeId: string): Promise<CreanceClient[]> {
  // Requêtes enchaînées, jamais lancées ensemble : le pooler en mode transaction ne rend pas la
  // main quand plusieurs partent en parallèle depuis une même requête HTTP (voir README).
  const allClients = await db.query.clients.findMany({
    where: eq(clients.storeId, storeId),
    orderBy: (c, { asc }) => [asc(c.nom)],
  });

  // Le tri des ventes à crédit se fait en base. La version précédente rapatriait TOUTES les ventes
  // validées de la boutique depuis son ouverture, avec leurs règlements, pour ne garder ensuite que
  // celles à crédit — un coût qui grandissait indéfiniment avec l'historique, sur un écran consulté
  // tous les jours.
  const storeCreditSales = await db.query.sales.findMany({
    where: and(
      eq(sales.storeId, storeId),
      eq(sales.statut, "VALIDEE"),
      isNotNull(sales.clientId),
      inArray(
        sales.id,
        db.select({ saleId: payments.saleId }).from(payments).where(eq(payments.mode, "CREDIT"))
      )
    ),
    columns: { id: true, numero: true, clientId: true, total: true, dateHeure: true },
    orderBy: (s, { asc }) => [asc(s.dateHeure)],
  });

  const settings = await db.query.notificationSettings.findFirst({
    where: eq(notificationSettings.storeId, storeId),
    columns: { creanceRetardJours: true },
  });

  const clientIds = allClients.map((c) => c.id);
  const storeRepayments = clientIds.length
    ? await db.query.debtRepayments.findMany({
        where: inArray(debtRepayments.clientId, clientIds),
        columns: { id: true, clientId: true, montant: true, date: true },
      })
    : [];

  const today = new Date();
  const fallbackEcheance = settings?.creanceRetardJours ?? DEFAULT_ECHEANCE_JOURS;

  return allClients.map((client) => {
    const clientSales = storeCreditSales
      .filter((s) => s.clientId === client.id)
      .sort((a, b) => a.dateHeure.getTime() - b.dateHeure.getTime());
    const totalCredit = clientSales.reduce((sum, s) => sum + n(s.total), 0);
    const totalRembourse = storeRepayments
      .filter((r) => r.clientId === client.id)
      .reduce((sum, r) => sum + n(r.montant), 0);
    const solde = totalCredit - totalRembourse;

    const echeanceEffective = client.echeanceJours ?? fallbackEcheance;

    let remaining = totalRembourse;
    let dateEcheance: string | null = null;
    let joursRetard: number | null = null;
    for (const s of clientSales) {
      const montant = n(s.total);
      if (remaining >= montant) {
        remaining -= montant;
        continue;
      }
      const due = new Date(s.dateHeure);
      due.setDate(due.getDate() + echeanceEffective);
      const diff = differenceInCalendarDays(today, due);
      dateEcheance = due.toISOString();
      joursRetard = diff > 0 ? diff : null;
      break;
    }

    return {
      id: client.id,
      nom: client.nom,
      telephone: client.telephone,
      archive: client.archive,
      limiteCredit: client.limiteCredit !== null ? n(client.limiteCredit) : null,
      echeanceJours: client.echeanceJours,
      echeanceEffective,
      solde,
      totalCredit,
      totalRembourse,
      dateEcheance,
      joursRetard,
      depassementLimite: client.limiteCredit !== null ? solde > n(client.limiteCredit) : false,
      creeLe: client.creeLe.toISOString(),
    };
  });
}
