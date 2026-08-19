// Programme de test — un lien unique partagé à tous les testeurs de la période d'ouverture
// restreinte. Celui qui l'utilise crée sa propre boutique, avec accès complet et gratuit jusqu'à
// la date de fin fixée dans l'administration.
//
// Le code vit en base (platform_settings) et non dans une variable d'environnement : il doit être
// révocable et prolongeable depuis l'administration, sans redéploiement, y compris un dimanche.

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformSettings } from "@/db/schema";

export type AccesTest =
  | { valide: true; expireLe: Date }
  | { valide: false; raison: "INCONNU" | "DESACTIVE" | "EXPIRE" };

/** Message destiné au visiteur. Volontairement sobre : un lien mort n'est pas de sa faute. */
export function messageRefus(raison: "INCONNU" | "DESACTIVE" | "EXPIRE"): string {
  if (raison === "EXPIRE") return "La période de test est terminée. Ce lien n'est plus valable.";
  if (raison === "DESACTIVE") return "Ce lien de test n'est plus actif.";
  return "Ce lien de test n'existe pas. Vérifiez l'adresse reçue.";
}

/**
 * Vérifie un code testeur. La comparaison ignore la casse : le code circule par WhatsApp et par
 * QR code, il sera recopié à la main plus souvent qu'on ne le croit.
 */
export async function verifierCodeTest(code: string | null | undefined): Promise<AccesTest> {
  if (!code || !code.trim()) return { valide: false, raison: "INCONNU" };

  const [reglages] = await db.select().from(platformSettings).limit(1);
  if (!reglages?.testLienCode) return { valide: false, raison: "INCONNU" };
  if (reglages.testLienCode.toLowerCase() !== code.trim().toLowerCase()) {
    return { valide: false, raison: "INCONNU" };
  }
  if (!reglages.testLienActif) return { valide: false, raison: "DESACTIVE" };

  // Sans date de fin, le lien reste ouvert : c'est un choix explicite de l'administrateur, pas
  // un oubli qui donnerait un accès gratuit perpétuel par défaut — le formulaire l'impose.
  const expireLe = reglages.testLienExpireLe;
  if (expireLe && expireLe.getTime() < Date.now()) return { valide: false, raison: "EXPIRE" };

  return { valide: true, expireLe: expireLe ?? new Date(Date.now() + 30 * 86_400_000) };
}

/** Adresse complète à partager, construite sur APP_URL pour rester juste en ligne comme en local. */
export function lienTest(code: string, base?: string): string {
  const racine = (base ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${racine}/testeur/${encodeURIComponent(code)}`;
}

/** Réglages du programme de test, pour l'administration. */
export async function reglagesTest() {
  const [r] = await db.select().from(platformSettings).limit(1);
  return {
    code: r?.testLienCode ?? null,
    actif: r?.testLienActif ?? false,
    expireLe: r?.testLienExpireLe ?? null,
  };
}

/** Crée la ligne de réglages si elle manque, et retourne son identifiant. */
export async function idReglages(): Promise<string> {
  const [existant] = await db.select({ id: platformSettings.id }).from(platformSettings).limit(1);
  if (existant) return existant.id;
  const [cree] = await db.insert(platformSettings).values({}).returning({ id: platformSettings.id });
  return cree.id;
}

export { eq, platformSettings };
