// Types partagés pour le module Rapports — §13 du cahier des charges.

export type PeriodType = "today" | "week" | "month" | "year" | "custom";

export type RapportsKpis = {
  chiffreAffaires: number;
  ventes: number;
  margeBrute: number;
  margePct: number; // marge / CA, en %
  achatsStock: number;
  autresDepenses: number;
  beneficeNet: number;
};

export type KpiDeltas = {
  chiffreAffaires: number | null;
  ventes: number | null;
  margeBrute: number | null;
  achatsStock: number | null;
  autresDepenses: number | null;
  beneficeNet: number | null;
};

export type ArgentEncaisse = {
  especes: number;
  mobileMoney: number;
  venduACredit: number;
  remboursementsCreances: number;
  resteEnCaisse: number;
};

export type EvolutionPoint = {
  label: string;
  ca: number;
};

export type TopProduitRow = {
  productId: string;
  nom: string;
  quantite: number;
  montant: number;
};

export type RapportsData = {
  period: {
    type: PeriodType;
    start: string;
    end: string;
    label: string;
  };
  previousPeriod: {
    start: string;
    end: string;
    label: string;
  };
  kpis: RapportsKpis;
  kpisPrecedente: RapportsKpis;
  deltas: KpiDeltas;
  argentEncaisse: ArgentEncaisse;
  evolution: EvolutionPoint[];
  topProduits: TopProduitRow[];
};
