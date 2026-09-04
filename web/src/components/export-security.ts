// Neutralisation de l'injection de formule dans les exports tableur (CSV / XLSX) — CWE-1236.
//
// Excel, LibreOffice et Google Sheets interprètent comme une formule toute cellule qui commence
// par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot — même dans un fichier CSV, et même
// sans signe égal explicite (héritage Lotus 1-2-3 : une cellule contenant "+cmd|'/C calc'!A1"
// s'exécute à l'ouverture). Or la quasi-totalité des champs texte de l'app — nom de client, de
// produit, de boutique — viennent de saisie libre et finissent dans un export lu par une autre
// personne (le patron qui exporte l'historique des ventes saisies par un vendeur, par exemple).
// Un nom de client du type `=HYPERLINK("http://…", "Voir la facture")` exécute alors du code, ou
// exfiltre la feuille, sur le poste de qui ouvre le fichier.
//
// L'échappement CSV classique (guillemets autour des valeurs contenant `"`, `;` ou un saut de
// ligne) ne protège pas contre ça : il sécurise la *structure* du fichier, pas l'*interprétation*
// de la cellule une fois le tableur ouvert. Les deux protections sont nécessaires, et dans cet
// ordre précis : neutraliser la formule d'abord, échapper le CSV ensuite — sinon l'apostrophe
// ajoutée ici se retrouve hors des guillemets ouvrants et casse la ligne.

/**
 * Neutralise une cellule qu'un tableur interpréterait comme une formule, en la préfixant d'une
 * apostrophe : la convention Excel/LibreOffice pour forcer l'affichage en texte brut, invisible
 * à l'ouverture (la cellule s'affiche sans l'apostrophe).
 *
 * Ne touche pas aux valeurs qui sont un nombre valide. Une colonne de montants (remise, solde de
 * créance, ajustement de stock…) contient légitimement des cellules commençant par "-" : les
 * neutraliser aveuglément transformerait ces montants en texte et casserait les sommes du
 * commerçant dans son tableur — une régression pire que la faille elle-même. Un tableur ne lit de
 * toute façon jamais un nombre pur comme une formule, qu'on ajoute l'apostrophe ou non ; seul un
 * texte qui *commence* par un de ces caractères sans être un nombre (donc potentiellement une
 * formule ou une commande) est une menace réelle.
 */
export function neutraliserFormule(valeur: string): string {
  const nettoyee = valeur.trim().replace(",", ".");
  if (nettoyee !== "" && Number.isFinite(Number(nettoyee))) return valeur;
  return /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
}

/**
 * Applique `neutraliserFormule` à chaque cellule texte d'une ligne d'export mixte (texte +
 * nombres). Les cellules déjà typées `number` ne passent jamais par la neutralisation : ce sont
 * des valeurs calculées par l'app (montants, quantités), jamais de la saisie libre, et un tableur
 * ne les interprète de toute façon jamais comme une formule — les laisser en `number` évite aussi
 * tout risque de les transformer en texte et de casser une somme.
 */
export function neutraliserLigne<T extends string | number>(ligne: T[]): T[] {
  return ligne.map((cellule) => (typeof cellule === "string" ? (neutraliserFormule(cellule) as T) : cellule));
}
