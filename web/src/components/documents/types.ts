// Types partagés du module Documents (§12 du cahier des charges).

export type DocumentType = "FACTURE" | "PROFORMA" | "REMBOURSEMENT";
export type DocumentStatut = "BROUILLON" | "EMISE" | "CONVERTIE" | "ANNULEE";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  numero: string;
  statut: DocumentStatut;
  date: string;
  montantTotal: number;
  clientNomAffiche: string | null;
  saleNumero: string | null;
  convertieEnVenteId: string | null;
};

export type DraftItem = {
  nom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
};

export type SaleItemRow = {
  id: string;
  productNom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
};

export type DocumentDetail = {
  id: string;
  type: DocumentType;
  numero: string;
  statut: DocumentStatut;
  date: string;
  montantTotal: number;
  clientId: string | null;
  clientNom: string | null;
  clientTelephone: string | null;
  clientNomLibre: string | null;
  saleId: string | null;
  convertieEnVenteId: string | null;
  itemsBrouillon: DraftItem[] | null;
  vendeurNom: string | null;
};

export type SaleDetail = {
  id: string;
  numero: string;
  dateHeure: string;
  total: number;
  items: SaleItemRow[];
};

export type ProductOption = { id: string; nom: string; prixVente: number };

export const TYPE_LABELS: Record<DocumentType, string> = {
  FACTURE: "Facture",
  PROFORMA: "Proforma",
  REMBOURSEMENT: "Remboursement",
};

export const STATUT_LABELS: Record<DocumentStatut, string> = {
  BROUILLON: "Brouillon",
  EMISE: "Émise",
  CONVERTIE: "Convertie",
  ANNULEE: "Annulée",
};

export const STATUT_TONES: Record<DocumentStatut, "neutral" | "success" | "warning" | "danger" | "info"> = {
  BROUILLON: "warning",
  EMISE: "info",
  CONVERTIE: "success",
  ANNULEE: "danger",
};
