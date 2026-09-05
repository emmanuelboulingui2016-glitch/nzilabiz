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
 * Repli. Entreprise n'a délibérément aucun tarif, ici ou en base : son prix n'est plus jamais
 * public, il se négocie boutique par boutique et se fixe depuis la fiche de la boutique dans
 * l'administration (`stores.tarifNegocie*`, voir `src/lib/paiements.ts`). Avant, un « à partir de »
 * annuel s'affichait ici — exactement le genre de champ que plus personne ne pensait à vérifier,
 * et qui aurait fini par réafficher un montant que le propriétaire ne veut plus montrer.
 */
export const TARIFS_DEFAUT: Grille = {
  ESSENTIEL: { mensuel: 15000, trimestriel: 40000, annuel: 150000 },
  PREMIUM: { mensuel: 35000, trimestriel: 95000, annuel: 350000 },
  ENTREPRISE: {},
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

/**
 * Période couverte par un paiement, pour un cycle donné.
 *
 * Même règle que la prolongation manuelle de l'administration (bouton « Prolonger » de la fiche
 * boutique, `src/app/api/superadmin/boutiques/[id]/route.ts`) : on repart de l'échéance en cours
 * si elle est encore future, sinon d'aujourd'hui — prolonger un abonnement expiré depuis trois mois
 * ne doit pas offrir ces trois mois gratuitement. Fonction pure : aucun accès base, aucune horloge
 * cachée — `maintenant` est un paramètre, pas `new Date()` appelé à l'intérieur, précisément pour
 * rester testable sans dépendre de l'instant d'exécution.
 *
 * Utilisée à l'émission d'une demande de paiement (`emettreDemandePaiement`) pour calculer
 * `periodeDebut`/`periodeFin`, et côté client pour prévisualiser cette période avant de valider.
 */
export function calculerPeriode(
  cycle: Cycle,
  echeanceActuelle: Date | null,
  maintenant: Date
): { debut: Date; fin: Date } {
  const debut = echeanceActuelle && echeanceActuelle.getTime() > maintenant.getTime()
    ? new Date(echeanceActuelle)
    : new Date(maintenant);
  const fin = new Date(debut);
  // `setMonth` gère le dépassement de fin de mois en repoussant sur le mois suivant (31 janvier +
  // 1 mois → 3 mars, pas 28/29 février) : un comportement JS natif documenté, pas un bug. Pour une
  // périodicité d'abonnement, ce choix est délibéré ici — l'échéance glisse d'au plus deux ou trois
  // jours certains mois plutôt que de la raccourcir, ce qui est le sens le plus favorable au
  // commerçant qui vient de payer.
  fin.setMonth(fin.getMonth() + MOIS_PAR_CYCLE[cycle]);
  return { debut, fin };
}
