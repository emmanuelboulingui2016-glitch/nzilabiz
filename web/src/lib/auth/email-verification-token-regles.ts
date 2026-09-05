/**
 * Règles pures des jetons de vérification d'adresse e-mail — hachage, durée de validité, messages
 * d'erreur.
 *
 * Isolées de `email-verification-token.ts`, qui importe `db` au niveau module (voir
 * `src/db/client.ts`) : tout fichier qui l'importe déclenche la lecture de `DATABASE_URL` et la
 * création du client Postgres, ce qui rend cette logique intestable sans base de données (voir
 * `src/lib/abonnement-etat.ts` pour le même principe déjà appliqué dans ce projet). Ce fichier ne
 * dépend de rien d'autre que `node:crypto` : il ne fait que dériver et comparer des jetons, jamais
 * lire ou écrire une ligne.
 */

import { createHash } from "node:crypto";

// Un lien de confirmation d'adresse est moins sensible qu'un accès au compte (le jeton de
// réinitialisation, lui, ouvre une session) : 24 heures laissent le temps de le retrouver dans les
// indésirables sans exposer une fenêtre déraisonnable.
export const VALIDITE_MINUTES = 60 * 24;

export type TypeJetonVerification = "INSCRIPTION" | "CHANGEMENT_EMAIL";

export function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** Date d'expiration d'un jeton créé à `maintenant`. */
export function dateExpiration(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + VALIDITE_MINUTES * 60_000);
}

export type JetonVerificationValide = {
  tokenId: string;
  userId: string;
  type: TypeJetonVerification;
  /** Adresse visée par CE jeton précis — pas forcément celle que porte `users` au moment de la lecture. */
  email: string;
  nom: string;
};

export type RaisonRefusVerification = "INTROUVABLE" | "EXPIRE" | "UTILISE" | "COMPTE_FERME";

export type VerificationJetonVerification =
  | { ok: true; jeton: JetonVerificationValide }
  | { ok: false; raison: RaisonRefusVerification };

export function messageJetonVerificationInvalide(raison: RaisonRefusVerification): string {
  switch (raison) {
    case "EXPIRE":
      return `Ce lien a expiré — il n'était valable que ${Math.round(VALIDITE_MINUTES / 60)} heures. Demandez-en un nouveau.`;
    case "UTILISE":
      return "Ce lien a déjà servi.";
    case "COMPTE_FERME":
      return "Ce compte a été supprimé et ne peut plus être utilisé.";
    default:
      return "Ce lien n'est pas valable. Il a peut-être été tronqué en chemin — demandez-en un nouveau.";
  }
}
