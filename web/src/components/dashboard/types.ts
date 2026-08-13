// Types partagés entre la récupération des données du tableau de bord (server) et les
// composants d'affichage (client). §5 du cahier des charges.

export type PaymentModeLabel = "ESPECES" | "MOBILE_MONEY" | "CREDIT";

export type RecentSaleRow = {
  id: string;
  numero: string;
  heure: string;
  article: string;
  qte: number;
  total: number;
  paiement: string;
};

export type TopProductRow = {
  productId: string;
  nom: string;
  quantite: number;
  total: number;
};

export type LowStockRow = {
  id: string;
  nom: string;
  quantiteStock: number;
  seuilAlerte: number;
  unite: string;
};

export type WeeklySalesPoint = {
  date: string; // yyyy-MM-dd
  label: string; // ex. "lun 11/08"
  total: number;
};

export type CashCountSummary = {
  id: string;
  montantSaisi: number;
  montantTheorique: number | null;
  ecart: number | null;
  date: string;
} | null;

export type DashboardData = {
  kpi: {
    caDuJour: number;
    caHier: number;
    caDeltaPct: number | null;
    ventesDuJour: number;
    ventesHier: number;
    ventesDeltaPct: number | null;
    creancesEnCours: number;
    depensesDuJour: number;
  };
  encaisse: {
    especes: number;
    mobileMoney: number;
    credit: number;
  };
  caisse: {
    fondOuverture: number;
    especesEncaissees: number;
    depensesEspeces: number;
    resteEnCaisse: number;
    cashCountOuverture: CashCountSummary;
    cashCountFermeture: CashCountSummary;
    ouvertureManquante: boolean;
  };
  weeklySales: WeeklySalesPoint[];
  lowStock: LowStockRow[];
  topProducts: TopProductRow[];
  recentSales: RecentSaleRow[];
};
