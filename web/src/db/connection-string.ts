/**
 * Chaîne de connexion à la base — source unique, exigée, jamais devinée.
 *
 * La version précédente retombait sur une chaîne de développement écrite dans le code quand
 * `DATABASE_URL` était absent. Deux problèmes, et le second est le pire :
 *
 *   1. Un identifiant écrit dans le code source, versionné, lisible par quiconque a le dépôt.
 *   2. Surtout : une variable d'environnement oubliée en production ne provoquait plus d'erreur
 *      claire. L'application tentait silencieusement une base locale inexistante, et la panne se
 *      manifestait bien plus loin, sous une forme incompréhensible. Une configuration manquante
 *      doit s'arrêter tout de suite, en disant laquelle.
 */
export function connectionStringRequise(contexte = "l'application"): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      `DATABASE_URL est absent : ${contexte} ne peut pas démarrer.\n` +
        "En local : copiez web/.env.example en web/.env et renseignez la variable.\n" +
        "En ligne : vérifiez les variables d'environnement de l'hébergeur."
    );
  }
  return url;
}

/**
 * Le pooler en **mode transaction** (port 6543 chez Supabase) n'accepte pas les instructions
 * préparées et ne garantit pas de retomber sur la même session d'une requête à l'autre.
 *
 * La détection porte sur le port et non sur le nom d'hôte : le pooler « session » de Supabase est
 * sur le même hôte mais sur le port 5432, accepte les instructions préparées et plusieurs
 * connexions. Le confondre avec le mode transaction briderait inutilement un serveur persistant.
 */
export function estModeTransaction(url: string): boolean {
  return /:6543(?:[/?]|$)|pgbouncer=true/.test(url);
}
