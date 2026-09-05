/**
 * Résolution du prix d'une ligne de vente face au catalogue — logique pure, isolée de
 * `src/app/api/vendre/create-sale.ts`, qui importe `db` au niveau module (voir `src/db/client.ts`) :
 * tout fichier qui l'importe déclenche la lecture de `DATABASE_URL` et la création du client
 * Postgres, ce qui rend la logique intestable sans base de données (voir `abonnement-etat.ts` et
 * `stock-import.ts`, isolés pour la même raison). Ce fichier ne dépend de rien : il ne fait que
 * comparer des nombres.
 *
 * Contexte métier (§ demande produit du 04/09) : un commerçant d'Afrique centrale négocie ses prix
 * au comptoir, y compris pour une braderie de fin de stock qui peut légitimement descendre bien
 * plus bas que l'ancien seuil fixe de 20 % appliqué par le correctif de sécurité de la nuit du
 * 03 au 04/09 (celui-ci refusait un prix client qui s'écartait de plus de 20 % du catalogue). Ce
 * seuil a été retiré : il aurait bloqué cette braderie légitime tout en restant impuissant contre
 * un détournement habile qui reste sous la barre des 20 %.
 *
 * Ce qui protège réellement le commerçant n'est donc plus un plafond de montant mais :
 *   1. un contrôle de DROIT (`vendre.prix.modifier`, voir `resolveItemPrice.canModifierPrix`) —
 *      le patron peut le retirer à un employé précis ;
 *   2. l'enregistrement SYSTÉMATIQUE du prix catalogue à côté du prix pratiqué
 *      (`saleItems.prixCatalogueUnitaire`, capturé sur CHAQUE ligne, modifiée ou non — voir
 *      create-sale.ts).
 * Un rabais consenti devient ainsi indiscernable d'un détournement au moment de la vente — sauf
 * que le patron peut toujours le voir après coup, ligne par ligne, ce qu'un seuil bloquant ne
 * permettait pas (il refusait ou laissait passer, mais ne conservait aucune trace structurée).
 *
 * Le seul garde-fou de montant qui reste : un prix négatif, NaN ou infini est toujours refusé,
 * quel que soit le droit de l'appelant — ça n'a jamais été une histoire de négociation
 * commerciale, c'est une valeur invalide.
 *
 * Ce qui ne passe jamais par ici, et ne doit jamais y passer : `prixAchatUnitaire`. Le prix
 * d'achat est une donnée interne de la boutique, jamais négociée au comptoir — `create-sale.ts` le
 * résout toujours depuis le catalogue serveur (`Number(product.prixAchat)`), sans jamais lire de
 * valeur envoyée par le client. Cette fonction ne le touche pas du tout, précisément pour qu'aucun
 * appelant ne puisse un jour la faire dévier de ce principe par erreur.
 */

export class CreateSaleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type PriceResolution = {
  /** Prix réellement pratiqué sur la ligne (catalogue si non modifié, prix négocié sinon). */
  prixUnitaire: number;
  /** Prix catalogue au moment de la vente, capturé même quand la ligne n'a pas été modifiée. */
  prixCatalogueUnitaire: number;
  /** true si `prixUnitaire` s'écarte du catalogue — sert à décider s'il faut journaliser la ligne. */
  divergence: boolean;
};

/**
 * Résout le prix unitaire d'une ligne de vente face au prix catalogue courant.
 *
 * @throws CreateSaleError si le prix déclaré est négatif, NaN ou infini (toujours refusé, quel
 * que soit le droit de l'appelant), ou s'il diverge du catalogue sans que l'appelant ait le droit
 * `vendre.prix.modifier`.
 */
export function resolveItemPrice(params: {
  nomProduit: string;
  catalogPrixVente: number;
  /** Prix envoyé par le client pour cette ligne ; `undefined` = pas de négociation (chemin en ligne par défaut). */
  prixDeclare: number | undefined;
  canModifierPrix: boolean;
}): PriceResolution {
  const { nomProduit, catalogPrixVente, prixDeclare, canModifierPrix } = params;

  if (prixDeclare === undefined) {
    return { prixUnitaire: catalogPrixVente, prixCatalogueUnitaire: catalogPrixVente, divergence: false };
  }

  // Garde-fou qui reste, quel que soit le droit de l'appelant : ce n'est pas une question de
  // négociation commerciale, c'est une valeur qui ne peut correspondre à aucune vente réelle.
  if (!Number.isFinite(prixDeclare) || prixDeclare < 0) {
    throw new CreateSaleError(`Le prix de vente déclaré pour "${nomProduit}" est invalide.`);
  }

  // FCFA : aucune décimale (voir src/lib/currency.ts) — un prix négocié au comptoir se dit en
  // francs entiers, jamais en centimes.
  const prixUnitaire = Math.round(prixDeclare);
  const divergence = prixUnitaire !== catalogPrixVente;

  if (divergence && !canModifierPrix) {
    throw new CreateSaleError(
      `Vous n'avez pas le droit de modifier le prix de "${nomProduit}". Prix catalogue : ${catalogPrixVente} FCFA.`,
      403
    );
  }

  return { prixUnitaire, prixCatalogueUnitaire: catalogPrixVente, divergence };
}
