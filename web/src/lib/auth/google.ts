/**
 * La connexion Google est facultative : elle n'existe que si les identifiants OAuth sont fournis.
 *
 * Sans eux, la route `/api/auth/google` ne peut rien faire d'autre que renvoyer l'utilisateur vers
 * la page de connexion avec un message d'erreur. Afficher malgré tout le bouton revient à promettre
 * une fonctionnalité absente : on le masque, plutôt que de laisser quelqu'un le découvrir en
 * cliquant. À réserver au serveur — ces variables ne doivent jamais atteindre le navigateur.
 */
export function googleConfigure(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}
