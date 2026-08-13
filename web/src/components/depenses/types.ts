export type ExpenseFrequence = "HEBDOMADAIRE" | "MENSUELLE";
export type PaymentMode = "ESPECES" | "MOBILE_MONEY" | "CREDIT";

export type Expense = {
  id: string;
  storeId: string;
  userId: string | null;
  categorie: string;
  description: string;
  montant: string;
  date: string;
  modeReglement: PaymentMode;
  recurrente: boolean;
  frequence: ExpenseFrequence | null;
  pieceJointeUrl: string | null;
  stockReceiptId: string | null;
};

export type ExpenseKpis = {
  totalMois: number;
  rachatsStockMois: number;
  autresDepensesMois: number;
  aujourdHui: number;
  transactionsMois: number;
  plusGrosseChargeMois: number;
};

export type ExpensesResponse = {
  expenses: Expense[];
  kpis: ExpenseKpis;
  categories: string[];
  suggestedCategories: string[];
  generatedRecurringCount: number;
};

// La colonne `description` sert de support à la fois pour le libellé et pour une éventuelle note
// libre (le schéma partagé n'a pas de colonne "note" dédiée — voir résumé de l'agent Dépenses).
// Convention : premier segment avant le premier saut de ligne = libellé, reste = note.
export function splitDescription(description: string): { libelle: string; note: string } {
  const idx = description.indexOf("\n");
  if (idx === -1) return { libelle: description, note: "" };
  return { libelle: description.slice(0, idx), note: description.slice(idx + 1) };
}

export const MODE_REGLEMENT_LABELS: Record<PaymentMode, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT: "Crédit",
};

export const FREQUENCE_LABELS: Record<ExpenseFrequence, string> = {
  HEBDOMADAIRE: "Hebdomadaire",
  MENSUELLE: "Mensuelle",
};
