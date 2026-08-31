/**
 * Ce que chaque formule ouvre réellement — source unique de vérité.
 *
 * La leçon vient de la formule Entreprise : elle a longtemps été une simple étiquette affichée en
 * badge, pendant que la page tarifs promettait de la « gestion multi-boutiques » qui n'existait
 * nulle part. Une formule qui ne change rien au produit est une promesse invendable, et une
 * limitation qui n'existe que dans l'interface n'est pas une limitation : il suffit d'appeler la
 * route directement.
 *
 * D'où deux règles tenues ici, et vérifiées dans le code appelant :
 *
 *   1. Chaque ligne d'un argumentaire commercial correspond à une entrée de ce fichier.
 *   2. Chaque entrée est appliquée **côté serveur**, dans la route qui écrit ou qui lit. Masquer un
 *      bouton ne ferme rien.
 *
 * `ESSAI` ouvre tout : on fait essayer le produit complet, pas une version diminuée — sinon
 * l'essai ne dit rien de ce qu'on achète. `PREMIUM` et `ENTREPRISE` ouvrent tout également ; seule
 * `ESSENTIEL` restreint. Aucune boutique existante n'est sur ESSENTIEL au moment où ce fichier est
 * écrit : l'ajout de la formule ne peut donc retirer un accès à personne.
 */

export type Formule = "ESSAI" | "ESSENTIEL" | "PREMIUM" | "ENTREPRISE";

/**
 * Fonctionnalités facturables. Volontairement peu nombreuses et grossières : une grille trop fine
 * devient impossible à expliquer à un commerçant, et impossible à tenir dans le code.
 *
 * Ce que cette liste ne contient volontairement pas : la validation des annulations de vente. Un
 * vendeur crée sa demande depuis l'écran Ventes, et c'est l'écran Approbations qui tranche.
 * Facturer le second sans fermer le premier laisserait des demandes que plus personne ne pourrait
 * traiter — une donnée bloquée, pas une fonctionnalité vendue. Un contrôle interne attaché aux
 * rôles n'est pas une option commerciale.
 */
export type Fonctionnalite =
  | "depenses"
  | "documents"
  | "rapports"
  | "devise"
  | "mobilemoney"
  | "reseau";

export const LIBELLE_FONCTIONNALITE: Record<Fonctionnalite, string> = {
  depenses: "Les dépenses",
  documents: "Les factures et proformas",
  rapports: "Les rapports et exports",
  devise: "Le changement de devise",
  mobilemoney: "La configuration Mobile Money",
  reseau: "La gestion de plusieurs boutiques",
};

export const LIBELLE_FORMULE: Record<Formule, string> = {
  ESSAI: "Essai gratuit",
  ESSENTIEL: "Essentiel",
  PREMIUM: "Premium",
  ENTREPRISE: "Entreprise",
};

const TOUT: Fonctionnalite[] = [
  "depenses",
  "documents",
  "rapports",
  "devise",
  "mobilemoney",
];

const INCLUS: Record<Formule, Fonctionnalite[]> = {
  // Un essai doit montrer le produit entier, réseau compris : c'est ce qui décide de l'achat.
  ESSAI: [...TOUT, "reseau"],
  // Le quotidien d'une boutique : vendre, suivre le stock, savoir qui doit de l'argent.
  ESSENTIEL: [],
  PREMIUM: TOUT,
  ENTREPRISE: [...TOUT, "reseau"],
};

/**
 * Plafond de comptes utilisateurs. `null` = sans limite.
 *
 * C'est la seule limite chiffrée, et elle porte sur les comptes, pas sur les appareils : refuser
 * l'ajout d'un employé est une action d'administration, qu'on peut refuser proprement avec un
 * message. Refuser une connexion depuis un troisième téléphone laisserait un vendeur dehors en
 * pleine journée de vente, sans qu'il comprenne pourquoi.
 */
const PLAFOND_COMPTES: Record<Formule, number | null> = {
  ESSAI: null,
  ESSENTIEL: 3,
  PREMIUM: null,
  ENTREPRISE: null,
};

function formuleValide(plan: string): Formule {
  return plan === "ESSENTIEL" || plan === "PREMIUM" || plan === "ENTREPRISE" ? plan : "ESSAI";
}

/** Cette formule ouvre-t-elle cette fonctionnalité ? */
export function formuleOuvre(plan: string, fonctionnalite: Fonctionnalite): boolean {
  return INCLUS[formuleValide(plan)].includes(fonctionnalite);
}

/** Nombre de comptes autorisés, `null` si illimité. */
export function plafondComptes(plan: string): number | null {
  return PLAFOND_COMPTES[formuleValide(plan)];
}

/** Message affiché quand une fonctionnalité est hors formule. */
export function messageHorsFormule(fonctionnalite: Fonctionnalite): string {
  return `${LIBELLE_FONCTIONNALITE[fonctionnalite]} ne fait pas partie de la formule Essentiel. Passez à Premium pour y accéder.`;
}

/** Argumentaire des formules — la même liste alimente le site public et l'écran Abonnement. */
export const ARGUMENTAIRE: Record<Exclude<Formule, "ESSAI">, { inclus: string[]; exclus: string[] }> = {
  ESSENTIEL: {
    inclus: [
      "Caisse et ventes illimitées",
      "Stock, réceptions et inventaire",
      "Clients et créances",
      "Tableau de bord du jour et de la semaine",
      "Mode hors connexion complet",
      "Alertes de stock bas et de péremption",
      "Jusqu'à 3 comptes (patron, gérant, vendeur)",
    ],
    exclus: [
      "Dépenses",
      "Factures et proformas",
      "Rapports et exports PDF/CSV",
      "Multi-devise et configuration Mobile Money",
    ],
  },
  PREMIUM: {
    inclus: [
      "Tout Essentiel, sans limite de comptes",
      "Dépenses et dépenses récurrentes",
      "Factures, proformas et remboursements",
      "Rapports avancés et exports PDF/CSV",
      "Multi-devise et configuration Mobile Money",
      "Support prioritaire WhatsApp",
    ],
    exclus: [],
  },
  ENTREPRISE: {
    inclus: [
      "Tout Premium",
      "Plusieurs boutiques sous un seul compte",
      "Chiffres consolidés sur tout le réseau",
      "Bascule d'une boutique à l'autre sans se reconnecter",
      "Un seul abonnement pour tout le réseau",
      "Support dédié et formation des équipes",
    ],
    exclus: [],
  },
};
