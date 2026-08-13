// Constantes de l'onglet Boutique — §14 du cahier des charges.

export type PaysOption = { nom: string; indicatif: string };

// Zone CEMAC en priorité (le marché principal de NzilaBiz), Gabon par défaut.
export const PAYS_OPTIONS: PaysOption[] = [
  { nom: "Gabon", indicatif: "+241" },
  { nom: "Cameroun", indicatif: "+237" },
  { nom: "Congo", indicatif: "+242" },
  { nom: "Guinée équatoriale", indicatif: "+240" },
  { nom: "Tchad", indicatif: "+235" },
  { nom: "République centrafricaine", indicatif: "+236" },
  { nom: "Côte d'Ivoire", indicatif: "+225" },
  { nom: "Sénégal", indicatif: "+221" },
];

export function indicatifForPays(pays: string): string {
  return PAYS_OPTIONS.find((p) => p.nom === pays)?.indicatif ?? "+241";
}

// Mêmes idées de catégories que les modèles de catalogue d'onboarding (src/lib/onboarding/templates.ts).
// ⚠️ La pharmacie est explicitement hors périmètre (cahier des charges §20) — ne pas l'ajouter ici.
export const TYPE_COMMERCE_OPTIONS: string[] = [
  "Épicerie",
  "Quincaillerie",
  "Vêtements",
  "Cosmétiques / Parfumerie",
  "Téléphonie",
];
