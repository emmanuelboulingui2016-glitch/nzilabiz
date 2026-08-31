// Passerelle entre le catalogue et le cache hors-ligne de la caisse.
//
// Extrait de vendre-screen.tsx, qui dépassait 600 lignes : ces deux fonctions ne dépendent d'aucun
// état React et se relisent seules. Les garder au milieu du composant obligeait à parcourir tout
// l'écran pour vérifier une conversion de champ.

import { offlineDb } from "@/lib/offline/db";
import type { VendreProduct } from "./types";

/**
 * Recopie le catalogue dans le cache local, pour que la caisse continue de fonctionner sans réseau.
 * Appelé aussi bien après un chargement en ligne qu'au premier affichage, à partir des données
 * rendues par le serveur — sans quoi ouvrir la caisse puis perdre le réseau laisserait un cache vide.
 */
export async function amorcerCacheLocal(liste: VendreProduct[]) {
  await offlineDb.products.bulkPut(
    liste.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      reference: p.reference,
      nom: p.nom,
      categoryId: p.categoryId,
      codeBarres: p.codeBarres,
      prixAchat: Number(p.prixAchat),
      prixVente: Number(p.prixVente),
      quantiteStock: Number(p.quantiteStock),
      seuilAlerte: Number(p.seuilAlerte),
      misAJourLe: new Date().toISOString(),
    }))
  );
}

export function toVendreProduct(p: {
  id: string;
  storeId: string;
  reference: string;
  nom: string;
  categoryId?: string | null;
  codeBarres?: string | null;
  prixAchat: number;
  prixVente: number;
  quantiteStock: number;
  seuilAlerte: number;
}): VendreProduct {
  return {
    id: p.id,
    storeId: p.storeId,
    reference: p.reference,
    nom: p.nom,
    photoUrl: null,
    categoryId: p.categoryId ?? null,
    codeBarres: p.codeBarres ?? null,
    prixAchat: String(p.prixAchat),
    prixVente: String(p.prixVente),
    prixGros: null,
    unite: "unité",
    quantiteStock: String(p.quantiteStock),
    seuilAlerte: String(p.seuilAlerte),
  };
}
