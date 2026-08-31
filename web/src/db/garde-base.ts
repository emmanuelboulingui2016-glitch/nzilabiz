/**
 * Garde-fou commun aux scripts qui écrivent des données de démonstration.
 *
 * Ces scripts créent des comptes, parfois avec des mots de passe simples, et supposent une base
 * jetable. Rien n'empêchait jusqu'ici de les lancer sur la base en ligne : il suffisait d'un
 * `DATABASE_URL` pointant ailleurs — un `.env` mal rangé, une variable héritée du terminal — pour
 * semer des comptes utilisables dans la base des vrais commerçants.
 *
 * On refuse donc par défaut toute base qui n'est pas manifestement locale, et on exige un aveu
 * explicite pour passer outre. Le refus est la valeur par défaut : c'est l'oubli qui doit être sans
 * conséquence, pas l'attention.
 */

/** Une base est jugée locale si elle est hébergée sur cette machine. */
export function estBaseLocale(url: string): boolean {
  try {
    const hote = new URL(url).hostname.toLowerCase();
    return hote === "localhost" || hote === "127.0.0.1" || hote === "::1" || hote === "host.docker.internal";
  } catch {
    return false;
  }
}

/**
 * Interrompt le script si la base visée n'est pas locale, sauf aveu explicite
 * (`--je-sais-ce-que-je-fais` ou `AUTORISER_BASE_DISTANTE=1`).
 *
 * @param nomScript nom affiché dans le message de refus
 */
export function refuserSiBaseDistante(url: string, nomScript: string): void {
  if (estBaseLocale(url)) return;

  const aveu =
    process.argv.includes("--je-sais-ce-que-je-fais") || process.env.AUTORISER_BASE_DISTANTE === "1";
  if (aveu) {
    console.warn(`⚠  ${nomScript} : exécution sur une base DISTANTE, à votre demande explicite.`);
    return;
  }

  // L'hôte est affiché, jamais les identifiants : ce message finit souvent copié dans une
  // conversation ou un ticket.
  let hote = "inconnu";
  try {
    hote = new URL(url).hostname;
  } catch {
    /* chaîne illisible : on garde « inconnu » plutôt que de risquer d'en afficher une partie */
  }

  throw new Error(
    `${nomScript} refuse de s'exécuter : la base visée (${hote}) n'est pas locale.\n` +
      "Ce script crée des données de démonstration et n'a rien à faire dans une base de production.\n" +
      "Si c'est réellement voulu, relancez avec --je-sais-ce-que-je-fais."
  );
}
