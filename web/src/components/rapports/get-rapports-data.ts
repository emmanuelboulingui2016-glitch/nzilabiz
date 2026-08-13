// Agrégation des données du module Rapports — §13 du cahier des charges.
//
// Formules importantes (voir aussi le résumé de fin de tâche) :
// - Marge brute = Σ (prixUnitaire - prixAchatUnitaire) × quantité, sur les lignes de vente
//   (sale_items) des ventes VALIDEE de la période. On utilise bien `prixAchatUnitaire`, le prix
//   d'achat FIGÉ au moment de la vente (jamais le `prixAchat` courant du produit, qui peut avoir
//   changé depuis) — c'est le point explicitement demandé par le cahier des charges.
// - Bénéfice net estimé = Marge brute − Autres dépenses (on NE soustrait PAS "Achats de stock" une
//   deuxième fois : le coût des marchandises vendues est déjà implicitement déduit dans le calcul de
//   la marge brute via prixAchatUnitaire).
// - Reste en caisse (période) = Espèces encaissées (paiements ESPECES des ventes validées de la
//   période) − Autres dépenses réglées en espèces de la période (hors "Rachats de stock"). C'est une
//   estimation "sur la période" : elle ne tient PAS compte d'un fond d'ouverture — ce chiffre-là (le
//   "vrai" reste en caisse en temps réel) vit sur le Dashboard, construit par un autre agent.

import { and, eq, gte, lte } from "drizzle-orm";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  parseISO,
  isValid,
} from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "@/db/client";
import { clients, debtRepayments, expenses, sales } from "@/db/schema";
import type { ArgentEncaisse, EvolutionPoint, KpiDeltas, PeriodType, RapportsData, RapportsKpis, TopProduitRow } from "./types";

const STOCK_PURCHASE_CATEGORY = "Rachats de stock";

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return null;
    return 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

type Range = { start: Date; end: Date };

function labelForRange(type: PeriodType, range: Range): string {
  if (type === "today") return format(range.start, "dd/MM/yyyy", { locale: fr });
  if (type === "year") return format(range.start, "yyyy", { locale: fr });
  return `${format(range.start, "dd/MM/yyyy", { locale: fr })} – ${format(range.end, "dd/MM/yyyy", { locale: fr })}`;
}

/** Calcule les bornes [start, end] (incluses) de la période demandée. */
export function getPeriodRange(
  type: PeriodType,
  customStart?: string | null,
  customEnd?: string | null,
  now: Date = new Date()
): Range {
  switch (type) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom": {
      const parsedStart = customStart ? parseISO(customStart) : now;
      const parsedEnd = customEnd ? parseISO(customEnd) : now;
      const start = isValid(parsedStart) ? startOfDay(parsedStart) : startOfDay(now);
      const endRaw = isValid(parsedEnd) ? endOfDay(parsedEnd) : endOfDay(now);
      // Sécurité : si l'utilisateur inverse les deux dates, on les remet dans l'ordre.
      const end = endRaw < start ? endOfDay(start) : endRaw;
      return { start, end };
    }
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

/** Période immédiatement précédente, de même longueur (mois/année : mois/année civil précédent). */
export function getPreviousPeriodRange(type: PeriodType, current: Range): Range {
  if (type === "month") {
    const prevMonthDate = subMonths(current.start, 1);
    return { start: startOfMonth(prevMonthDate), end: endOfMonth(prevMonthDate) };
  }
  if (type === "year") {
    const prevYearDate = subYears(current.start, 1);
    return { start: startOfYear(prevYearDate), end: endOfYear(prevYearDate) };
  }
  // today / week / custom : on décale d'exactement la même durée (en jours).
  const durationDays = differenceInCalendarDays(current.end, current.start) + 1;
  const prevEnd = endOfDay(subDays(current.start, 1));
  const prevStart = startOfDay(subDays(prevEnd, durationDays - 1));
  return { start: prevStart, end: prevEnd };
}

async function computeKpis(storeId: string, range: Range): Promise<RapportsKpis> {
  const [salesRows, expenseRows] = await Promise.all([
    db.query.sales.findMany({
      where: and(
        eq(sales.storeId, storeId),
        eq(sales.statut, "VALIDEE"),
        gte(sales.dateHeure, range.start),
        lte(sales.dateHeure, range.end)
      ),
      columns: { id: true, total: true },
      with: {
        items: { columns: { prixUnitaire: true, prixAchatUnitaire: true, quantite: true } },
      },
    }),
    db.query.expenses.findMany({
      where: and(eq(expenses.storeId, storeId), gte(expenses.date, range.start), lte(expenses.date, range.end)),
      columns: { categorie: true, montant: true },
    }),
  ]);

  const chiffreAffaires = salesRows.reduce((sum, s) => sum + n(s.total), 0);
  const ventes = salesRows.length;

  let margeBrute = 0;
  for (const sale of salesRows) {
    for (const item of sale.items) {
      margeBrute += (n(item.prixUnitaire) - n(item.prixAchatUnitaire)) * n(item.quantite);
    }
  }
  const margePct = chiffreAffaires !== 0 ? (margeBrute / chiffreAffaires) * 100 : 0;

  const achatsStock = expenseRows
    .filter((e) => e.categorie === STOCK_PURCHASE_CATEGORY)
    .reduce((sum, e) => sum + n(e.montant), 0);
  const autresDepenses = expenseRows
    .filter((e) => e.categorie !== STOCK_PURCHASE_CATEGORY)
    .reduce((sum, e) => sum + n(e.montant), 0);

  // Bénéfice net estimé = marge brute − autres dépenses (le coût des marchandises vendues est déjà
  // implicitement compté dans la marge brute — on ne re-soustrait pas "Achats de stock").
  const beneficeNet = margeBrute - autresDepenses;

  return { chiffreAffaires, ventes, margeBrute, margePct, achatsStock, autresDepenses, beneficeNet };
}

function buildEvolution(type: PeriodType, range: Range, salesRows: { dateHeure: Date; total: string }[]): EvolutionPoint[] {
  const days = differenceInCalendarDays(range.end, range.start) + 1;
  const useMonthlyBuckets = type === "year" || (type === "custom" && days > 62);
  const useHourlyBuckets = type === "today";

  if (useMonthlyBuckets) {
    const months = eachMonthOfInterval({ start: range.start, end: range.end });
    const totalsByMonth = new Map<string, number>();
    for (const s of salesRows) {
      const key = format(s.dateHeure, "yyyy-MM");
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + n(s.total));
    }
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      return { label: format(m, "MMM yy", { locale: fr }), ca: totalsByMonth.get(key) ?? 0 };
    });
  }

  if (useHourlyBuckets) {
    const totalsByHour = new Array(24).fill(0) as number[];
    for (const s of salesRows) {
      const h = s.dateHeure.getHours();
      totalsByHour[h] += n(s.total);
    }
    return totalsByHour.map((ca, h) => ({ label: `${String(h).padStart(2, "0")}h`, ca }));
  }

  // Buckets journaliers (semaine / mois / custom court).
  const daysList = eachDayOfInterval({ start: range.start, end: range.end });
  const totalsByDay = new Map<string, number>();
  for (const s of salesRows) {
    const key = format(s.dateHeure, "yyyy-MM-dd");
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + n(s.total));
  }
  return daysList.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return { label: format(d, "dd/MM", { locale: fr }), ca: totalsByDay.get(key) ?? 0 };
  });
}

export async function getRapportsData(
  storeId: string,
  type: PeriodType,
  customStart?: string | null,
  customEnd?: string | null
): Promise<RapportsData> {
  const range = getPeriodRange(type, customStart, customEnd);
  const previousRange = getPreviousPeriodRange(type, range);

  const [current, previous, evolutionSalesRows, debtRepaymentRows] = await Promise.all([
    computeKpis(storeId, range),
    computeKpis(storeId, previousRange),
    db.query.sales.findMany({
      where: and(
        eq(sales.storeId, storeId),
        eq(sales.statut, "VALIDEE"),
        gte(sales.dateHeure, range.start),
        lte(sales.dateHeure, range.end)
      ),
      columns: { dateHeure: true, total: true },
    }),
    db
      .select({ montant: debtRepayments.montant })
      .from(debtRepayments)
      .innerJoin(clients, eq(debtRepayments.clientId, clients.id))
      .where(and(eq(clients.storeId, storeId), gte(debtRepayments.date, range.start), lte(debtRepayments.date, range.end))),
  ]);

  // Détail des ventes de la période (paiements + articles) pour l'encaissement et le top produits.
  const detailedSales = await db.query.sales.findMany({
    where: and(
      eq(sales.storeId, storeId),
      eq(sales.statut, "VALIDEE"),
      gte(sales.dateHeure, range.start),
      lte(sales.dateHeure, range.end)
    ),
    columns: { id: true },
    with: {
      payments: { columns: { mode: true, montant: true } },
      items: { columns: { productId: true, quantite: true, sousTotal: true }, with: { product: { columns: { nom: true } } } },
    },
  });

  let especes = 0;
  let mobileMoney = 0;
  let venduACredit = 0;
  for (const sale of detailedSales) {
    for (const p of sale.payments) {
      const montant = n(p.montant);
      if (p.mode === "ESPECES") especes += montant;
      else if (p.mode === "MOBILE_MONEY") mobileMoney += montant;
      else if (p.mode === "CREDIT") venduACredit += montant;
    }
  }

  const expenseRowsForCaisse = await db.query.expenses.findMany({
    where: and(eq(expenses.storeId, storeId), gte(expenses.date, range.start), lte(expenses.date, range.end)),
    columns: { categorie: true, montant: true, modeReglement: true },
  });
  const autresDepensesEspeces = expenseRowsForCaisse
    .filter((e) => e.categorie !== STOCK_PURCHASE_CATEGORY && e.modeReglement === "ESPECES")
    .reduce((sum, e) => sum + n(e.montant), 0);

  const remboursementsCreances = debtRepaymentRows.reduce((sum, r) => sum + n(r.montant), 0);

  // Reste en caisse (période) — voir note en tête de fichier pour la définition exacte retenue.
  const resteEnCaisse = especes - autresDepensesEspeces;

  const argentEncaisse: ArgentEncaisse = { especes, mobileMoney, venduACredit, remboursementsCreances, resteEnCaisse };

  const productAgg = new Map<string, TopProduitRow>();
  for (const sale of detailedSales) {
    for (const item of sale.items) {
      const existing = productAgg.get(item.productId);
      const quantite = n(item.quantite);
      const montant = n(item.sousTotal);
      if (existing) {
        existing.quantite += quantite;
        existing.montant += montant;
      } else {
        productAgg.set(item.productId, {
          productId: item.productId,
          nom: item.product?.nom ?? "Produit",
          quantite,
          montant,
        });
      }
    }
  }
  const topProduits = Array.from(productAgg.values())
    .sort((a, b) => b.montant - a.montant)
    .slice(0, 10);

  const evolution = buildEvolution(type, range, evolutionSalesRows);

  const deltas: KpiDeltas = {
    chiffreAffaires: pctDelta(current.chiffreAffaires, previous.chiffreAffaires),
    ventes: pctDelta(current.ventes, previous.ventes),
    margeBrute: pctDelta(current.margeBrute, previous.margeBrute),
    achatsStock: pctDelta(current.achatsStock, previous.achatsStock),
    autresDepenses: pctDelta(current.autresDepenses, previous.autresDepenses),
    beneficeNet: pctDelta(current.beneficeNet, previous.beneficeNet),
  };

  return {
    period: {
      type,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: labelForRange(type, range),
    },
    previousPeriod: {
      start: previousRange.start.toISOString(),
      end: previousRange.end.toISOString(),
      label: labelForRange(type, previousRange),
    },
    kpis: current,
    kpisPrecedente: previous,
    deltas,
    argentEncaisse,
    evolution,
    topProduits,
  };
}
