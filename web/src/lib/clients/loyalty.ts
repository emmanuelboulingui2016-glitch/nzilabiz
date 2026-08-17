// Segmentation de la clientèle — module Clients.
//
// Le segment n'est jamais stocké en base : il est recalculé à chaque lecture depuis l'historique
// des ventes VALIDEE du client. Un client change donc de segment tout seul quand il revient
// acheter (ou quand il cesse de venir), sans aucune action du commerçant.
//
// Les seuils ci-dessous sont volontairement adaptés au commerce de proximité d'Afrique centrale :
// un client de boutique de quartier passe souvent plusieurs fois par mois, un « fidèle » se
// reconnaît donc au nombre de passages récents plus qu'au montant dépensé.

export const SEUIL_FIDELE_ACHATS = 5;
export const SEUIL_FIDELE_JOURS = 60;
export const SEUIL_RECURRENT_ACHATS = 2;
export const SEUIL_RECURRENT_JOURS = 90;
export const SEUIL_NOUVEAU_JOURS = 30;
export const SEUIL_INACTIF_JOURS = 90;

export type ClientSegment = "FIDELE" | "RECURRENT" | "NOUVEAU" | "OCCASIONNEL" | "INACTIF" | "SANS_ACHAT";

export const SEGMENT_LABELS: Record<ClientSegment, string> = {
  FIDELE: "Fidèle",
  RECURRENT: "Récurrent",
  NOUVEAU: "Nouveau",
  OCCASIONNEL: "Occasionnel",
  INACTIF: "Inactif",
  SANS_ACHAT: "Sans achat",
};

export const SEGMENT_DESCRIPTIONS: Record<ClientSegment, string> = {
  FIDELE: `Au moins ${SEUIL_FIDELE_ACHATS} achats, dont un dans les ${SEUIL_FIDELE_JOURS} derniers jours.`,
  RECURRENT: `Au moins ${SEUIL_RECURRENT_ACHATS} achats, dont un dans les ${SEUIL_RECURRENT_JOURS} derniers jours.`,
  NOUVEAU: `Premier achat il y a moins de ${SEUIL_NOUVEAU_JOURS} jours.`,
  OCCASIONNEL: "Achète de temps en temps, sans régularité.",
  INACTIF: `Aucun achat depuis plus de ${SEUIL_INACTIF_JOURS} jours — à relancer.`,
  SANS_ACHAT: "Fiche créée, aucun achat enregistré à son nom.",
};

export function segmentClient({
  nbAchats,
  joursDepuisDernierAchat,
  joursDepuisPremierAchat,
}: {
  nbAchats: number;
  joursDepuisDernierAchat: number | null;
  joursDepuisPremierAchat: number | null;
}): ClientSegment {
  if (nbAchats === 0 || joursDepuisDernierAchat === null) return "SANS_ACHAT";
  if (nbAchats >= SEUIL_FIDELE_ACHATS && joursDepuisDernierAchat <= SEUIL_FIDELE_JOURS) return "FIDELE";
  if (nbAchats >= SEUIL_RECURRENT_ACHATS && joursDepuisDernierAchat <= SEUIL_RECURRENT_JOURS) return "RECURRENT";
  if (joursDepuisPremierAchat !== null && joursDepuisPremierAchat <= SEUIL_NOUVEAU_JOURS) return "NOUVEAU";
  if (joursDepuisDernierAchat > SEUIL_INACTIF_JOURS) return "INACTIF";
  return "OCCASIONNEL";
}

// Nombre moyen de jours entre deux achats — indicateur de régularité affiché sur la fiche client.
// Null tant qu'il n'y a pas au moins deux achats (aucun intervalle mesurable).
export function frequenceAchatJours({
  nbAchats,
  premierAchat,
  dernierAchat,
}: {
  nbAchats: number;
  premierAchat: Date | null;
  dernierAchat: Date | null;
}): number | null {
  if (nbAchats < 2 || !premierAchat || !dernierAchat) return null;
  const jours = (dernierAchat.getTime() - premierAchat.getTime()) / 86_400_000;
  if (jours <= 0) return null;
  return Math.round(jours / (nbAchats - 1));
}
