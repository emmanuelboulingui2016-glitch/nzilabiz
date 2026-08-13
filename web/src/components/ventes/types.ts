// Types partagés du module Ventes — §7 du cahier des charges.

export type PaymentMode = "ESPECES" | "MOBILE_MONEY" | "CREDIT";
export type SaleStatut = "VALIDEE" | "ANNULEE";

export type SaleItemRow = {
  id: string;
  productNom: string;
  quantite: string;
  prixUnitaire: string;
  sousTotal: string;
};

export type SalePaymentRow = {
  mode: PaymentMode;
  montant: string;
  montantRecu: string | null;
  monnaieRendue: string | null;
};

export type SaleRow = {
  id: string;
  numero: string;
  dateHeure: string;
  statut: SaleStatut;
  motifAnnulation: string | null;
  total: string;
  qte: number;
  itemsCount: number;
  premierArticle: string;
  clientNom: string | null;
  vendeurNom: string | null;
  paiements: PaymentMode[];
  items: SaleItemRow[];
  payments: SalePaymentRow[];
};

export type VentesKpis = {
  caAujourdhui: number;
  transactions: number;
  ventesCredit: { count: number; montant: number };
};

export type ApprovalRequestRow = {
  id: string;
  motif: string | null;
  creeLe: string;
  demandeParNom: string;
  sale: { id: string; numero: string; total: string; dateHeure: string } | null;
};

export const MOTIF_OPTIONS: { value: string; label: string }[] = [
  { value: "erreur_saisie", label: "Erreur de saisie" },
  { value: "retour_client", label: "Retour client" },
  { value: "geste_commercial", label: "Geste commercial" },
  { value: "autre", label: "Autre" },
];

export const PAIEMENT_LABELS: Record<PaymentMode, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT: "Crédit",
};
