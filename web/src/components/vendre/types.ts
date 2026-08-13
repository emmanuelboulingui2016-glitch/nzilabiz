// Types partagés de l'écran Vendre (POS). §6 du cahier des charges.

export type VendreProduct = {
  id: string;
  storeId: string;
  reference: string;
  nom: string;
  photoUrl: string | null;
  categoryId: string | null;
  codeBarres: string | null;
  prixAchat: string;
  prixVente: string;
  prixGros: string | null;
  unite: string;
  quantiteStock: string;
  seuilAlerte: string;
};

export type VendreCategory = { id: string; nom: string };

export type VendreClient = { id: string; nom: string; telephone: string | null };

export type CartLine = {
  productId: string;
  nom: string;
  /** Prix de vente figé au moment de l'ajout au panier (= prix au moment de la vente). */
  prixUnitaire: number;
  /** Prix d'achat figé au moment de l'ajout au panier (sert au calcul de marge plus tard). */
  prixAchatUnitaire: number;
  quantite: number;
  stockDisponible: number;
  unite: string;
};

export type PaymentMode = "ESPECES" | "MOBILE_MONEY" | "CREDIT";

export type PaymentLine = {
  mode: PaymentMode;
  montant: number;
  montantRecu?: number | null;
  reference?: string | null;
};

export type DiscountType = "MONTANT" | "POURCENTAGE";

export type ReceiptData = {
  numero: string;
  dateHeure: string;
  storeName: string;
  clientNom?: string | null;
  items: { nom: string; quantite: number; prixUnitaire: number; sousTotal: number }[];
  sousTotal: number;
  remise: number;
  typeRemise: DiscountType;
  total: number;
  payments: PaymentLine[];
  /** true si la vente n'a pas encore été confirmée par le serveur (créée hors-ligne, en attente de synchro). */
  pending?: boolean;
};
