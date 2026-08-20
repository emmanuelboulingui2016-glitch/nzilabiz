/**
 * La connexion Google est facultative : elle n'existe que si les identifiants OAuth sont fournis.
 *
 * Sans eux, la route `/api/auth/google` ne peut rien faire d'autre que renvoyer l'utilisateur vers
 * la page de connexion avec un message d'erreur. Afficher malgré tout le bouton revient à promettre
 * une fonctionnalité absente : on le masque, plutôt que de laisser quelqu'un le découvrir en
 * cliquant. À réserver au serveur — ces variables ne doivent jamais atteindre le navigateur.
 *
 * Les trois variables sont exigées ensemble, et pas seulement l'identifiant et le secret : sans
 * GOOGLE_REDIRECT_URI le départ du parcours échoue immédiatement. Un bouton visible dont on sait
 * déjà qu'il n'aboutira pas est exactement ce qu'on cherche à éviter.
 */
export function googleConfigure(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REDIRECT_URI?.trim()
  );
}

/**
 * Cookie qui porte le paramètre `state` entre le départ vers Google et le retour. Nommé ici pour
 * que le départ et le retour ne puissent pas diverger sur une faute de frappe — une comparaison
 * qui échoue toujours se manifesterait comme « la connexion Google ne marche pas », sans indice.
 */
export const GOOGLE_STATE_COOKIE = "nzilabiz_oauth_state";
