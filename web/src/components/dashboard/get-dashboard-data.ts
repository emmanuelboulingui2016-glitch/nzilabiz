// Agrégation des données du tableau de bord — §5 du cahier des charges.
// Utilisé à la fois par la page serveur (src/app/(app)/dashboard/page.tsx) et par la route API
// GET /api/dashboard (pour un éventuel rafraîchissement côté client sans recharger la page).

import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "@/db/client";
import { cashCounts, clients, debtRepayments, expenses, payments, products, sales } from "@/db/schema";
import type { DashboardData, RecentSaleRow, TopProductRow } from "./types";

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT: "Crédit",
};

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function pctDelta(today: number, yesterday: number): number | null {
  if (yesterday === 0) {
    if (today === 0) return null;
    return 100;
  }
  return ((today - yesterday) / yesterday) * 100;
}

export async function getDashboardData(storeId: string): Promise<DashboardData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd = endOfDay(subDays(now, 1));
  const weekStart = startOfDay(subDays(now, 6));

  const [todaySales, yesterdaySalesRows, weekSalesRows, creditPaymentRows, debtRepaymentRows, expensesTodayRows, lowStockProducts, cashCountOuverture, cashCountFermeture] =
    await Promise.all([
      db.query.sales.findMany({
        where: and(
          eq(sales.storeId, storeId),
          eq(sales.statut, "VALIDEE"),
          gte(sales.dateHeure, todayStart),
          lt(sales.dateHeure, todayEnd)
        ),
        with: {
          items: { with: { product: true } },
          payments: true,
        },
        orderBy: desc(sales.dateHeure),
      }),
      db.query.sales.findMany({
        where: and(
          eq(sales.storeId, storeId),
          eq(sales.statut, "VALIDEE"),
          gte(sales.dateHeure, yesterdayStart),
          lt(sales.dateHeure, yesterdayEnd)
        ),
        columns: { id: true, total: true },
      }),
      db.query.sales.findMany({
        where: and(
          eq(sales.storeId, storeId),
          eq(sales.statut, "VALIDEE"),
          gte(sales.dateHeure, weekStart),
          lt(sales.dateHeure, todayEnd)
        ),
        columns: { total: true, dateHeure: true },
      }),
      db
        .select({ montant: payments.montant })
        .from(payments)
        .innerJoin(sales, eq(payments.saleId, sales.id))
        .where(and(eq(sales.storeId, storeId), eq(sales.statut, "VALIDEE"), eq(payments.mode, "CREDIT"))),
      db
        .select({ montant: debtRepayments.montant })
        .from(debtRepayments)
        .innerJoin(clients, eq(debtRepayments.clientId, clients.id))
        .where(eq(clients.storeId, storeId)),
      db.query.expenses.findMany({
        where: and(eq(expenses.storeId, storeId), gte(expenses.date, todayStart), lt(expenses.date, todayEnd)),
        columns: { montant: true, modeReglement: true },
      }),
      db.query.products.findMany({
        where: and(eq(products.storeId, storeId), lte(products.quantiteStock, products.seuilAlerte)),
        orderBy: asc(products.quantiteStock),
        limit: 5,
      }),
      db.query.cashCounts.findFirst({
        where: and(
          eq(cashCounts.storeId, storeId),
          eq(cashCounts.type, "OUVERTURE"),
          gte(cashCounts.date, todayStart),
          lt(cashCounts.date, todayEnd)
        ),
        orderBy: desc(cashCounts.date),
      }),
      db.query.cashCounts.findFirst({
        where: and(
          eq(cashCounts.storeId, storeId),
          eq(cashCounts.type, "FERMETURE"),
          gte(cashCounts.date, todayStart),
          lt(cashCounts.date, todayEnd)
        ),
        orderBy: desc(cashCounts.date),
      }),
    ]);

  // --- KPI CA / ventes du jour vs hier ---
  const caDuJour = todaySales.reduce((sum, s) => sum + n(s.total), 0);
  const ventesDuJour = todaySales.length;
  const caHier = yesterdaySalesRows.reduce((sum, s) => sum + n(s.total), 0);
  const ventesHier = yesterdaySalesRows.length;

  // --- Créances en cours (store-wide) : total des paiements CREDIT sur ventes validées, moins
  // les remboursements de créance déjà reçus. Filtré par storeId directement dans les requêtes ci-dessus. ---
  const totalCredit = creditPaymentRows.reduce((sum, p) => sum + n(p.montant), 0);
  const totalRepayments = debtRepaymentRows.reduce((sum, r) => sum + n(r.montant), 0);
  const creancesEnCours = Math.max(0, totalCredit - totalRepayments);

  // --- Dépenses du jour ---
  const depensesDuJour = expensesTodayRows.reduce((sum, e) => sum + n(e.montant), 0);
  const depensesEspeces = expensesTodayRows
    .filter((e) => e.modeReglement === "ESPECES")
    .reduce((sum, e) => sum + n(e.montant), 0);

  // --- Encaissé aujourd'hui, par mode de paiement ---
  let especes = 0;
  let mobileMoney = 0;
  let credit = 0;
  for (const sale of todaySales) {
    for (const p of sale.payments) {
      const montant = n(p.montant);
      if (p.mode === "ESPECES") especes += montant;
      else if (p.mode === "MOBILE_MONEY") mobileMoney += montant;
      else if (p.mode === "CREDIT") credit += montant;
    }
  }

  // --- 🔧 Fond de caisse d'ouverture + reste en caisse ---
  const fondOuverture = cashCountOuverture ? n(cashCountOuverture.montantSaisi) : 0;
  const resteEnCaisse = fondOuverture + especes - depensesEspeces;

  // --- Graphique Ventes de la semaine (7 jours) ---
  const days = eachDayOfInterval({ start: weekStart, end: todayStart });
  const totalsByDay = new Map<string, number>();
  for (const s of weekSalesRows) {
    const key = format(s.dateHeure, "yyyy-MM-dd");
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + n(s.total));
  }
  const weeklySales = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      date: key,
      label: format(d, "EEE dd/MM", { locale: fr }),
      total: totalsByDay.get(key) ?? 0,
    };
  });

  // --- Widget Alertes stock ---
  const lowStock = lowStockProducts.map((p) => ({
    id: p.id,
    nom: p.nom,
    quantiteStock: n(p.quantiteStock),
    seuilAlerte: n(p.seuilAlerte),
    unite: p.unite,
  }));

  // --- 🔧 Top produits du jour ---
  const productAgg = new Map<string, TopProductRow>();
  for (const sale of todaySales) {
    for (const item of sale.items) {
      const key = item.productId;
      const existing = productAgg.get(key);
      const qte = n(item.quantite);
      const total = n(item.sousTotal);
      if (existing) {
        existing.quantite += qte;
        existing.total += total;
      } else {
        productAgg.set(key, { productId: key, nom: item.product?.nom ?? "Produit", quantite: qte, total });
      }
    }
  }
  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // --- Tableau Ventes récentes ---
  const recentSales: RecentSaleRow[] = todaySales.slice(0, 10).map((sale) => {
    const items = sale.items;
    const firstItemName = items[0]?.product?.nom ?? "—";
    const article = items.length > 1 ? `${firstItemName} +${items.length - 1}` : firstItemName;
    const qte = items.reduce((sum, it) => sum + n(it.quantite), 0);
    const modes = Array.from(new Set(sale.payments.map((p) => p.mode)));
    const paiement = modes.length > 1 ? "Mixte" : MODE_LABELS[modes[0] ?? ""] ?? "—";
    return {
      id: sale.id,
      numero: sale.numero,
      heure: format(sale.dateHeure, "HH:mm"),
      article,
      qte,
      total: n(sale.total),
      paiement,
    };
  });

  return {
    kpi: {
      caDuJour,
      caHier,
      caDeltaPct: pctDelta(caDuJour, caHier),
      ventesDuJour,
      ventesHier,
      ventesDeltaPct: pctDelta(ventesDuJour, ventesHier),
      creancesEnCours,
      depensesDuJour,
    },
    encaisse: { especes, mobileMoney, credit },
    caisse: {
      fondOuverture,
      especesEncaissees: especes,
      depensesEspeces,
      resteEnCaisse,
      cashCountOuverture: cashCountOuverture
        ? {
            id: cashCountOuverture.id,
            montantSaisi: n(cashCountOuverture.montantSaisi),
            montantTheorique: cashCountOuverture.montantTheorique ? n(cashCountOuverture.montantTheorique) : null,
            ecart: cashCountOuverture.ecart ? n(cashCountOuverture.ecart) : null,
            date: cashCountOuverture.date.toISOString(),
          }
        : null,
      cashCountFermeture: cashCountFermeture
        ? {
            id: cashCountFermeture.id,
            montantSaisi: n(cashCountFermeture.montantSaisi),
            montantTheorique: cashCountFermeture.montantTheorique ? n(cashCountFermeture.montantTheorique) : null,
            ecart: cashCountFermeture.ecart ? n(cashCountFermeture.ecart) : null,
            date: cashCountFermeture.date.toISOString(),
          }
        : null,
      ouvertureManquante: !cashCountOuverture,
    },
    weeklySales,
    lowStock,
    topProducts,
    recentSales,
  };
}
