import { randomBytes } from "node:crypto";

/**
 * Mot de passe temporaire remis de vive voix : dix caractères alphanumériques dérivés d'octets
 * aléatoires cryptographiques. Il sera dicté au téléphone ou recopié à la main, d'où l'absence de
 * ponctuation — un caractère spécial mal entendu coûte un aller-retour de plus.
 *
 * Il n'est affiché qu'une fois, à la création du compte ou à sa réinitialisation, et n'est jamais
 * conservé en clair.
 */
export function generateTempPassword(): string {
  return randomBytes(8).toString("base64url").slice(0, 10);
}
