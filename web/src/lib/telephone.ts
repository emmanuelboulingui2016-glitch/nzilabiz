/**
 * Normalisation des numéros de téléphone — l'identifiant de connexion des employés.
 *
 * Le projet a déjà payé ce genre d'étourderie avec les adresses e-mail : sans passage en
 * minuscules, « Jean@Gmail.com » et « jean@gmail.com » devenaient deux comptes distincts, et un
 * commerçant inscrit depuis son téléphone (majuscule automatique) ne se reconnectait plus depuis
 * son ordinateur. Le commentaire en tête de `src/lib/validation/auth.ts` raconte l'histoire.
 *
 * Le téléphone tend le même piège, en pire. Pour un vendeur gabonais, « 07 00 00 00 »,
 * « +241 07 00 00 00 » et « 24107000000 » sont le même numéro. Pour PostgreSQL, ce sont trois
 * valeurs différentes : trois comptes possibles, et un employé qui ne comprend pas pourquoi le
 * numéro qu'il tape est refusé alors que c'est bien le sien.
 *
 * D'où une règle unique, appliquée partout : **on stocke et on compare toujours la forme
 * normalisée**, chiffres seuls, indicatif pays compris. L'affichage, lui, se fait par groupes.
 */

/** Gabon. Chaque boutique porte le sien dans `stores.indicatif`, sous la forme « +241 ». */
const INDICATIF_DEFAUT = "241";

/**
 * Un numéro trop court est une faute de frappe, un numéro trop long aussi. Les bornes sont larges
 * à dessein : l'application vise plusieurs pays d'Afrique centrale, dont les plans de numérotation
 * diffèrent, et refuser un numéro valide est bien plus grave qu'en accepter un douteux — le
 * premier empêche un vendeur de travailler.
 */
const LONGUEUR_MIN = 8;
const LONGUEUR_MAX = 15;

/** Ne garde que les chiffres, et retire les zéros de tête d'une numérotation nationale. */
function chiffres(brut: string): string {
  return brut.replace(/[^\d]/g, "");
}

function indicatifNettoye(indicatif: string | null | undefined): string {
  const c = chiffres(indicatif ?? "");
  return c || INDICATIF_DEFAUT;
}

/**
 * Forme canonique d'un numéro : chiffres seuls, indicatif pays en tête.
 *
 * `null` quand la saisie ne peut pas être un numéro — à l'appelant de refuser proprement, sans
 * jamais inventer une valeur de repli qui créerait un compte inatteignable.
 */
export function normaliserTelephone(brut: string, indicatifBoutique?: string | null): string | null {
  const saisi = chiffres(brut);
  if (!saisi) return null;

  const indicatif = indicatifNettoye(indicatifBoutique);

  // Déjà préfixé par l'indicatif ? On ne le remet pas deux fois. La condition de longueur écarte
  // le cas où un numéro national commencerait par hasard par les mêmes chiffres : on n'enlève
  // l'indicatif que s'il reste ensuite de quoi former un numéro (au moins 6 chiffres).
  let national = saisi;
  if (saisi.startsWith(indicatif) && saisi.length - indicatif.length >= 6) {
    national = saisi.slice(indicatif.length);
  }

  // « 07 00 00 00 » et « 7 00 00 00 » désignent le même abonné : le zéro de tête appartient à la
  // numérotation nationale et disparaît dès qu'on préfixe l'indicatif.
  national = national.replace(/^0+/, "");
  if (!national) return null;

  const complet = indicatif + national;
  if (complet.length < LONGUEUR_MIN || complet.length > LONGUEUR_MAX) return null;
  return complet;
}

/** Affichage lisible : indicatif détaché, puis des paires. « 24107000000 » → « +241 07 00 00 00 ». */
export function formaterTelephone(normalise: string | null | undefined, indicatifBoutique?: string | null): string {
  if (!normalise) return "";
  const indicatif = indicatifNettoye(indicatifBoutique);
  const national = normalise.startsWith(indicatif) ? normalise.slice(indicatif.length) : normalise;
  const avecZero = national.length % 2 === 1 ? `0${national}` : national;
  const paires = avecZero.match(/.{1,2}/g) ?? [avecZero];
  return `+${indicatif} ${paires.join(" ")}`;
}

/** Un identifiant de connexion contenant « @ » est une adresse, sinon c'est un numéro. */
export function estAdresseEmail(identifiant: string): boolean {
  return identifiant.includes("@");
}
