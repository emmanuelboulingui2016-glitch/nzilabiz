/**
 * Validation des fichiers envoyés depuis le navigateur.
 *
 * Les images (photos de produits, logo de boutique) et les justificatifs de dépenses sont stockés
 * en base64 dans une colonne texte. Les formulaires posent bien un `accept="image/*"`, mais cet
 * attribut ne vit que dans le navigateur : le serveur, lui, acceptait **n'importe quelle chaîne, de
 * n'importe quelle taille**. Un compte connecté pouvait donc y déposer plusieurs mégaoctets par
 * produit — renvoyés ensuite à chaque affichage de l'écran Stock, à tout le monde.
 *
 * Deux règles, et rien de plus : une taille plafonnée, et un contenu qui ressemble réellement à une
 * image ou à un document.
 */

import { z } from "zod";

/**
 * ≈ 1 Mo de données binaires : le base64 pèse environ un tiers de plus que la source. Généreux pour
 * une photo de produit prise au téléphone, assez bas pour qu'aucune boutique ne puisse remplir la
 * base à elle seule.
 */
export const TAILLE_MAX_CARACTERES = 1_400_000;

const PREFIXE_IMAGE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/;
const PREFIXE_DOCUMENT = /^data:(image\/(png|jpe?g|webp|gif|avif)|application\/pdf);base64,[A-Za-z0-9+/=\s]+$/;
const URL_DISTANTE = /^https:\/\/\S+$/;

function verificateur(motif: RegExp, quoi: string) {
  return z
    .string()
    .max(TAILLE_MAX_CARACTERES, `${quoi} est trop volumineux (1 Mo maximum). Réduisez-le et réessayez.`)
    .refine((v) => v === "" || motif.test(v) || URL_DISTANTE.test(v), {
      message: `${quoi} n'est pas dans un format accepté.`,
    });
}

/** Photo de produit ou logo de boutique : image seulement. */
export const imageEnvoyee = verificateur(PREFIXE_IMAGE, "Ce fichier");

/** Justificatif de dépense : image ou PDF, comme le propose le formulaire. */
export const justificatifEnvoye = verificateur(PREFIXE_DOCUMENT, "Ce justificatif");

/**
 * Contrôle hors schéma Zod, pour les routes qui lisent leur corps de requête à la main.
 * Renvoie le message d'erreur, ou `null` si la valeur est acceptable.
 */
export function refusJustificatif(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  if (typeof valeur !== "string") return "Ce justificatif n'est pas dans un format accepté.";
  const r = justificatifEnvoye.safeParse(valeur);
  return r.success ? null : (r.error.issues[0]?.message ?? "Justificatif refusé.");
}
