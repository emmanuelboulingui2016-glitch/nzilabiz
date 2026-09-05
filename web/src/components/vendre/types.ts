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
  /**
   * Prix réellement pratiqué sur cette ligne — celui envoyé au serveur. Part du prix catalogue au
   * moment de l'ajout au panier, mais reste modifiable ensuite (négociation au comptoir, §
   * demande produit du 04/09) si `VendreScreen` reçoit `canModifierPrix`. Le serveur reste seul
   * juge de ce qui est finalement accepté (voir create-sale.ts) : ce champ n'est qu'une intention
   * côté caisse.
   */
  prixUnitaire: number;
  /**
   * Prix catalogue au moment de l'ajout au panier — jamais modifié après coup, contrairement à
   * `prixUnitaire`. Sert de référence à l'écran pour signaler un écart au vendeur ("ce que je
   * consens"), en miroir de `saleItems.prixCatalogueUnitaire` côté serveur.
   */
  prixCatalogueUnitaire: number;
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
