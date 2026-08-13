// Types partagés du module Créances (§9 du cahier des charges).

export type ClientCreance = {
  id: string;
  nom: string;
  telephone: string | null;
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

export type CreanceVente = {
  id: string;
  numero: string;
  dateHeure: string;
  total: number;
};

export type DebtRepaymentRow = {
  id: string;
  clientId: string;
  clientNom: string;
  montant: number;
  mode: "ESPECES" | "MOBILE_MONEY" | "CREDIT";
  date: string;
  saleId: string | null;
  saleNumero?: string | null;
};

// Convertit un numéro de téléphone local (Gabon par défaut, indicatif +241) en format
// international sans le "+" attendu par le lien wa.me. Retourne null si aucun numéro exploitable.
export function toWhatsAppPhone(telephone: string | null | undefined): string | null {
  if (!telephone) return null;
  const digits = telephone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("241")) return digits;
  if (digits.startsWith("0")) return `241${digits.slice(1)}`;
  if (digits.length <= 9) return `241${digits}`;
  return digits;
}
