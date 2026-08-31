/**
 * Grille tarifaire — déclarations partagées.
 *
 * Ce fichier ne touche pas la base : il est importé par des composants client (l'écran Abonnement
 * et la page tarifs publique) qui n'ont besoin que des libellés, des cycles et du calcul de
 * remise. Y laisser un `import { db }` suffisait à faire entrer le pilote Postgres dans le paquet
 * envoyé au navigateur — la compilation échouait sur `fs`, `net`, `tls`. La lecture en base vit
 * dans `tarifs-serveur.ts`.
 *
 * Les montants étaient écrits en dur à deux endroits : `components/public/pricing.tsx` et
 * `components/parametres/abonnement/subscription-view.tsx`. Deux copies d'un même prix finissent
 * toujours par diverger, et changer un tarif imposait un déploiement — alors qu'une remise de
 * rentrée se décide un lundi matin.
 *
 * Les valeurs par défaut ci-dessous servent quand la ligne n'existe pas encore en base ou quand la
 * base est indisponible. La page tarifs ne doit jamais s'afficher sans prix : un visiteur devant
 * une grille vide s'en va.
 */

export type Cycle = "mensuel" | "trimestriel" | "annuel";

export const CYCLES: Cycle[] = ["mensuel", "trimestriel", "annuel"];

export const LIBELLE_CYCLE: Record<Cycle, string> = {
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  annuel: "Annuel",
};

/** Nombre de mois couverts, pour calculer le coût ramené au mois et l'économie affichée. */
export const MOIS_PAR_CYCLE: Record<Cycle, number> = { mensuel: 1, trimestriel: 3, annuel: 12 };

/** Formules facturées. `ESSAI` n'a pas de prix, et n'apparaît donc pas dans la grille. */
export const PLANS_TARIFES = ["ESSENTIEL", "PREMIUM", "ENTREPRISE"] as const;
export type PlanTarife = (typeof PLANS_TARIFES)[number];

export type Grille = Record<PlanTarife, Partial<Record<Cycle, number>>>;

/**
 * Repli. Entreprise n'a qu'un tarif annuel, présenté comme un « à partir de » : son prix se fixe
 * au devis, selon le nombre de boutiques.
 */
export const TARIFS_DEFAUT: Grille = {
  ESSENTIEL: { mensuel: 15000, trimestriel: 40000, annuel: 150000 },
  PREMIUM: { mensuel: 35000, trimestriel: 95000, annuel: 350000 },
  ENTREPRISE: { annuel: 700000 },
};

/** Économie réalisée par rapport à douze mensualités, en pourcentage. `0` si non calculable. */
export function economiePourcent(grille: Grille, plan: PlanTarife, cycle: Cycle): number {
  const mensuel = grille[plan].mensuel;
  const montant = grille[plan][cycle];
  if (!mensuel || !montant || cycle === "mensuel") return 0;
  const plein = mensuel * MOIS_PAR_CYCLE[cycle];
  if (plein <= 0 || montant >= plein) return 0;
  return Math.round(((plein - montant) / plein) * 100);
}
