/**
 * Calculs purs de l'échéance d'une boutique.
 *
 * Isolés de `abonnement.ts`, qui importe `db` au niveau module (voir `src/db/client.ts`) : tout
 * fichier qui l'importe déclenche la lecture de `DATABASE_URL` et la création du client Postgres,
 * ce qui rend la logique intestable sans base de données. Ce fichier ne dépend de rien : il ne
 * fait que comparer des dates.
 */

export type RaisonBlocage = "ESSAI_EXPIRE" | "ABONNEMENT_EXPIRE";

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Jours restants avant une échéance, arrondis au jour supérieur. Négatif une fois l'échéance
 * dépassée, `0` le jour même.
 */
export function joursRestantsAvant(echeance: Date, maintenant: number = Date.now()): number {
  return Math.ceil((echeance.getTime() - maintenant) / JOUR_MS);
}

/** Vrai si l'échéance est atteinte ou dépassée. */
export function echeanceDepassee(echeance: Date, maintenant: number = Date.now()): boolean {
  return echeance.getTime() <= maintenant;
}

/** Message affiché quand une boutique est bloquée pour échéance dépassée. */
export function messageBlocage(raison: RaisonBlocage): string {
  return raison === "ESSAI_EXPIRE"
    ? "Votre période d'essai est terminée."
    : "Votre abonnement est arrivé à échéance.";
}
