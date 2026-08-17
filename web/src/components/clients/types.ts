// Types partagés du module Clients (gestion de la clientèle et de la fidélité).

import type { ClientSegment } from "@/lib/clients/loyalty";

export type ClientFiche = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  notes: string | null;
  archive: boolean;
  limiteCredit: number | null;
  echeanceJours: number | null;
  creeLe: string;
  nbAchats: number;
  totalAchats: number;
  panierMoyen: number;
  premierAchat: string | null;
  dernierAchat: string | null;
  joursDepuisDernierAchat: number | null;
  frequenceJours: number | null;
  soldeCreance: number;
  segment: ClientSegment;
};

export type ClientAchat = {
  id: string;
  numero: string;
  dateHeure: string;
  total: number;
};

export type ClientTopProduit = {
  productId: string;
  nom: string;
  quantite: number;
  montant: number;
};

export const SEGMENT_TONES: Record<ClientSegment, "success" | "info" | "warning" | "danger" | "neutral"> = {
  FIDELE: "success",
  RECURRENT: "info",
  NOUVEAU: "info",
  OCCASIONNEL: "neutral",
  INACTIF: "warning",
  SANS_ACHAT: "neutral",
};
