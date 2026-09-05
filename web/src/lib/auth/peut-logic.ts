// Logique pure de résolution d'un droit à partir de permissions déjà résolues — extraite de
// session.ts (qui importe `db` au niveau module, voir src/db/client.ts, donc intestable sans base
// de données) pour rester testable. Même procédé déjà en place sur ce projet pour la même raison :
// `src/components/parametres/utilisateurs/permissions-logic.ts`, `src/lib/abonnement-etat.ts`,
// `src/lib/stock-import.ts`.
//
// Ne sait rien de la session, du jeton JWT ni de la base : on lui donne un tableau de permissions
// déjà résolues (matrice de rôle + dérogations actives, voir rbac.ts::resoudrePermissions) et elle
// répond à la seule question qui compte pour un appelant : « cette permission en fait-elle partie ? »

import type { Permission } from "@/lib/auth/rbac";

/** Ce dont `resoudrePeut` a besoin : un tableau de permissions déjà résolues, rien de plus. */
export type ActeurAvecPermissions = { permissions: Permission[] };

/**
 * Vrai si `permission` fait partie des permissions déjà résolues de l'acteur. `null`/`undefined`
 * (pas de session, ou acteur introuvable) refuse toujours plutôt que de lever une exception : un
 * appelant qui a oublié de vérifier l'authentification avant d'appeler `peut()` obtient un refus
 * silencieux, jamais un accès.
 */
export function resoudrePeut(acteur: ActeurAvecPermissions | null | undefined, permission: Permission): boolean {
  if (!acteur) return false;
  return acteur.permissions.includes(permission);
}
