// Utilitaires et types partagés du module Stock (§8 du cahier des charges).
// Importé à la fois par les routes API (src/app/api/stock/**) et les composants UI
// (src/components/stock/**) pour éviter toute duplication de logique métier.

export type StockStatus = "ok" | "faible" | "rupture";

export function computeStatut(quantiteStock: number, seuilAlerte: number): StockStatus {
  if (quantiteStock <= 0) return "rupture";
  if (quantiteStock <= seuilAlerte) return "faible";
  return "ok";
}

export const STATUT_LABELS: Record<StockStatus, string> = {
  ok: "En stock",
  faible: "Stock faible",
  rupture: "Rupture",
};

export const STATUT_TONES: Record<StockStatus, "success" | "warning" | "danger"> = {
  ok: "success",
  faible: "warning",
  rupture: "danger",
};

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export const MOTIF_AJUSTEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "CASSE", label: "Casse" },
  { value: "PERTE", label: "Perte" },
  { value: "VOL", label: "Vol" },
  { value: "INVENTAIRE", label: "Inventaire physique" },
  { value: "AUTRE", label: "Autre" },
];

export const MODE_REGLEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CREDIT", label: "Crédit fournisseur" },
];

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  VENTE: "Vente",
  ANNULATION: "Annulation",
  RECEPTION: "Réception",
  AJUSTEMENT: "Ajustement",
};

export const MOVEMENT_TYPE_TONES: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  VENTE: "info",
  ANNULATION: "warning",
  RECEPTION: "success",
  AJUSTEMENT: "neutral",
};

// ---------------------------------------------------------------------------
// Import CSV — mapping de colonnes tolérant (§8 Import CSV/Excel en masse)
// ---------------------------------------------------------------------------

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

// Clé = champ produit interne, valeur = variantes d'en-têtes CSV acceptées (normalisées).
export const CSV_FIELD_ALIASES: Record<string, string[]> = {
  nom: ["nom", "produit", "name", "designation", "libelle", "article", "product"],
  categorie: ["categorie", "category", "rayon", "famille"],
  codeBarres: ["codebarres", "codebarre", "barcode", "ean", "ean13", "code"],
  prixAchat: ["prixachat", "prixdachat", "costprice", "cout", "achat", "cost"],
  prixVente: ["prixvente", "sellprice", "price", "vente", "prix", "prixdevente"],
  prixGros: ["prixgros", "wholesaleprice", "gros", "prixdegros"],
  unite: ["unite", "unit", "unitemesure", "unites"],
  quantiteStock: ["quantite", "quantitestock", "stock", "qty", "quantity", "qte", "quantiteinitiale"],
  seuilAlerte: ["seuilalerte", "seuil", "threshold", "alertethreshold", "alerte"],
};

export const A_PAYER_NOTE =
  "Estimation basée sur les réceptions de livraison réglées « à crédit fournisseur » — le schéma actuel ne suit pas de remboursements fournisseurs individuels, ce montant reste donc indicatif.";

// ---------------------------------------------------------------------------
// Types échangés avec les routes API
// ---------------------------------------------------------------------------

export type ProductRow = {
  id: string;
  reference: string;
  nom: string;
  photoUrl: string | null;
  categoryId: string | null;
  categoryNom: string | null;
  codeBarres: string | null;
  datePeremption: string | null;
  prixAchat: string;
  prixVente: string;
  prixGros: string | null;
  unite: string;
  quantiteStock: string;
  seuilAlerte: string;
  statut: StockStatus;
  creeLe: string;
};

export type CategoryRow = { id: string; nom: string };

export type StockKpis = {
  totalProduits: number;
  valeurStock: number;
  stockFaible: number;
  ruptureStock: number;
  aPayer: number;
};

export type MovementRow = {
  id: string;
  type: "VENTE" | "ANNULATION" | "RECEPTION" | "AJUSTEMENT";
  quantite: string;
  motif: string | null;
  date: string;
  userId: string | null;
  userNom: string | null;
  saleId: string | null;
  stockReceiptId: string | null;
};
