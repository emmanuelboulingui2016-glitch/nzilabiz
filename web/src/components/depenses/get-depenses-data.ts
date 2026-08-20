// Chargement des dépenses — lecture seule, partagée par la page serveur et par GET /api/depenses.
//
// La génération des dépenses récurrentes échues reste dans la route API et n'est volontairement pas
// appelée ici : ce serait une écriture pendant le rendu d'une page, or Next.js pré-rend les pages au
// survol des liens de navigation. Passer la souris sur « Dépenses » créerait des écritures en base.
// La page affiche donc immédiatement ce qui existe, et l'appel à l'API qui suit déclenche la
// génération — l'utilisateur voit ses chiffres sans attendre, et rien n'est écrit par accident.

import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";

export const SUGGESTED_CATEGORIES = ["Loyer", "Salaires", "Internet", "Transport", "Électricité"];

// Bornes de période reprises telles quelles de la route d'origine, et non tirées de date-fns : la
// semaine commence ici le LUNDI, là où `startOfWeek` de date-fns la fait commencer le dimanche.
// Utiliser la version de la bibliothèque aurait changé silencieusement le sens du filtre.
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0 = dimanche
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

export type FiltresDepenses = { periode?: string | null; categorie?: string | null; q?: string | null };

export async function chargerDepenses(storeId: string, filtres: FiltresDepenses = {}) {
  const periode = filtres.periode ?? "mois";
  const categorie = filtres.categorie ?? "";
  const q = filtres.q ?? "";

  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  let periodStart: Date | null = monthStart;
  switch (periode) {
    case "aujourdhui":
      periodStart = todayStart;
      break;
    case "semaine":
      periodStart = startOfWeek(now);
      break;
    case "mois":
      periodStart = monthStart;
      break;
    case "annee":
      periodStart = startOfYear(now);
      break;
    case "tout":
      periodStart = null;
      break;
    default:
      periodStart = monthStart;
  }

  const conditions = [eq(expenses.storeId, storeId)];
  if (periodStart) conditions.push(gte(expenses.date, periodStart));
  if (categorie) conditions.push(eq(expenses.categorie, categorie));
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    conditions.push(or(ilike(expenses.description, like), ilike(expenses.categorie, like))!);
  }

  const list = await db.query.expenses.findMany({
    where: and(...conditions),
    orderBy: [desc(expenses.date)],
  });

  // KPI toujours calculés sur le mois en cours / aujourd'hui, indépendamment des filtres du tableau.
  const monthExpenses = await db.query.expenses.findMany({
    where: and(eq(expenses.storeId, storeId), gte(expenses.date, monthStart)),
  });

  let totalMois = 0;
  let rachatsStockMois = 0;
  let autresDepensesMois = 0;
  let aujourdHui = 0;
  let plusGrosseChargeMois = 0;

  for (const e of monthExpenses) {
    const montant = Number(e.montant);
    totalMois += montant;
    if (e.stockReceiptId) {
      rachatsStockMois += montant;
    } else {
      autresDepensesMois += montant;
    }
    if (new Date(e.date) >= todayStart) {
      aujourdHui += montant;
    }
    if (montant > plusGrosseChargeMois) {
      plusGrosseChargeMois = montant;
    }
  }

  const allCategories = await db.query.expenses.findMany({
    where: eq(expenses.storeId, storeId),
    columns: { categorie: true },
  });
  const categories = Array.from(
    new Set([...SUGGESTED_CATEGORIES, ...allCategories.map((c) => c.categorie)])
  ).sort((a, b) => a.localeCompare(b, "fr"));

  return {
    // Dates sérialisées explicitement : la route API les convertissait implicitement en passant par
    // JSON, le rendu serveur non. Les deux chemins doivent produire la même forme.
    expenses: list.map((e) => ({ ...e, date: e.date.toISOString() })),
    kpis: {
      totalMois,
      rachatsStockMois,
      autresDepensesMois,
      aujourdHui,
      transactionsMois: monthExpenses.length,
      plusGrosseChargeMois,
    },
    categories,
    suggestedCategories: SUGGESTED_CATEGORIES,
  };
}
