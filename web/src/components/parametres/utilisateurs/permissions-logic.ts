/**
 * Logique pure du module Utilisateurs (§14) : résolution des administrateurs de la boutique, fuseau
 * horaire du commerçant, fenêtre de restauration de 48h.
 *
 * Isolée de `queries.ts`, qui importe `db` au niveau module (voir `src/db/client.ts`) : tout
 * fichier qui l'importe déclenche la lecture de `DATABASE_URL` et la création du client Postgres, ce
 * qui rend cette logique intestable sans base de données. Même procédé que `src/lib/abonnement-etat.ts`
 * et `src/lib/stock-import.ts`, déjà en place sur ce projet pour la même raison — voir queries.test.ts.
 */

export type MembreBoutique = { id: string; role: "PATRON" | "GERANT" | "VENDEUR" };

/**
 * Pour chaque dérogation active de `parametres.utilisateurs` dans la boutique, la plus récente par
 * utilisateur. La base ne contraint pas l'unicité des dérogations actives (schema.ts), donc
 * plusieurs lignes actives sur le même utilisateur sont possibles en théorie ; seule la plus
 * récente compte.
 */
export function derniereDerogationParUtilisateur(
  lignes: { userId: string; action: "ACCORDEE" | "RETIREE"; creeLe: Date }[]
): Map<string, "ACCORDEE" | "RETIREE"> {
  const derniere = new Map<string, { action: "ACCORDEE" | "RETIREE"; creeLe: Date }>();
  for (const l of lignes) {
    const courante = derniere.get(l.userId);
    if (!courante || l.creeLe.getTime() > courante.creeLe.getTime()) {
      derniere.set(l.userId, { action: l.action, creeLe: l.creeLe });
    }
  }
  return new Map([...derniere.entries()].map(([userId, v]) => [userId, v.action]));
}

/**
 * Pour chaque membre de la boutique, indique s'il a effectivement `parametres.utilisateurs` —
 * matrice de rôle (seul PATRON l'a par défaut) ou dérogation active. Sert au garde-fou qui empêche
 * de retirer ce droit au dernier administrateur de la boutique.
 */
export function resoudreAdministrateurs(
  membres: MembreBoutique[],
  derogations: Map<string, "ACCORDEE" | "RETIREE">
): Map<string, boolean> {
  const resultat = new Map<string, boolean>();
  for (const m of membres) {
    const derogation = derogations.get(m.id);
    resultat.set(m.id, derogation ? derogation === "ACCORDEE" : m.role === "PATRON");
  }
  return resultat;
}

const FUSEAU_COMMERCANT = "Africa/Libreville";

/**
 * Vrai si `date` tombe le même jour calendaire que `reference` dans le fuseau du commerçant
 * (Afrique centrale) — pas celui du serveur, qui peut tourner n'importe où.
 */
export function estAujourdHuiPourLeCommercant(date: Date, reference: Date = new Date()): boolean {
  const format = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_COMMERCANT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return format.format(date) === format.format(reference);
}

/** Heure locale du commerçant, format "HH:mm" — pour afficher "Aujourd'hui à 14:32". */
export function heureLocaleCommercant(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU_COMMERCANT,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Fenêtre de restauration d'un compte supprimé par le patron (chantier B) : 48h à partir de
 * l'instant de la suppression. Écrite comme fonction pure (plutôt qu'inline dans la route) pour
 * être testable, et réutilisée à la fois côté serveur (calcul de l'échéance) et côté client
 * (vérifier si elle est dépassée), avec le même code des deux côtés.
 */
const FENETRE_RESTAURATION_MS = 48 * 60 * 60 * 1000;

export function calculerExpirationRestauration(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + FENETRE_RESTAURATION_MS);
}

/** Vrai si la fenêtre de restauration est dépassée à `maintenant` (par défaut : l'instant présent). */
export function restaurationExpiree(expireLe: Date, maintenant: Date = new Date()): boolean {
  return expireLe.getTime() <= maintenant.getTime();
}
