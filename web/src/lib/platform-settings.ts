// Réglages de la plateforme — lecture partagée par le site public, l'aide de l'application et
// l'administration.
//
// Une seule ligne en base. Si elle n'existe pas encore (première installation), on renvoie des
// valeurs par défaut plutôt que null : aucune page ne doit tomber en panne parce que
// l'administrateur n'a pas encore rempli le formulaire.

import { db } from "@/db/client";
import { platformSettings } from "@/db/schema";

export type PlatformSettings = typeof platformSettings.$inferSelect;

export const DEFAUTS = {
  nomApplication: "NzilaBiz",
  slogan: "Gérez votre boutique, simplement, au quotidien",
  supportTelephone: null,
  supportWhatsapp: null,
  supportEmail: "contact@nzilabiz.store",
  supportHoraires: null,
  annonce: null,
  annonceActive: false,
  editeurRaisonSociale: null,
  editeurFormeJuridique: null,
  editeurAdresse: null,
  editeurImmatriculation: null,
  editeurDirecteurPublication: null,
  hebergeurNom: null,
  hebergeurAdresse: null,
  hebergeurPays: null,
  droitApplicable: null,
  juridictionCompetente: null,
  autoriteProtectionDonnees: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
} as const;

export type PlatformSettingsView = PlatformSettings | (typeof DEFAUTS & { id: null; misAJourLe: null });

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  const ligne = await db.query.platformSettings.findFirst();
  if (ligne) return ligne;
  return { ...DEFAUTS, id: null, misAJourLe: null };
}

/** Numéro WhatsApp au format attendu par wa.me (chiffres uniquement, indicatif inclus). */
export function whatsappLien(numero: string | null | undefined, message?: string): string | null {
  if (!numero) return null;
  const chiffres = numero.replace(/[^\d]/g, "");
  if (!chiffres) return null;
  const base = `https://wa.me/${chiffres}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export type ContactCommercial = {
  /** Numéro WhatsApp réduit aux chiffres — pour composer un lien avec un message sur mesure. */
  whatsappNumero: string | null;
  /** Lien WhatsApp prêt à l'emploi, message générique. */
  whatsapp: string | null;
  telephone: string | null;
  email: string | null;
};

/**
 * Coordonnées à présenter à un commerçant qui veut souscrire ou faire évoluer sa formule.
 *
 * Elles sortent des réglages de la plateforme, éditables depuis l'administration. Les boutons
 * « Nous contacter » portaient jusqu'ici une adresse écrite en dur — sur `nzilabiz.com`, quand le
 * site est publié sur `nzilabiz.store`. Les demandes de devis partaient donc dans le vide, et rien
 * ne pouvait le signaler : un lien `mailto:` ne rate jamais visiblement.
 */
export function contactCommercial(r: PlatformSettingsView): ContactCommercial {
  const chiffres = r.supportWhatsapp?.replace(/[^\d]/g, "") || null;
  return {
    whatsappNumero: chiffres,
    whatsapp: whatsappLien(r.supportWhatsapp, "Bonjour, je souhaite des informations sur les formules NzilaBiz."),
    telephone: r.supportTelephone ?? null,
    email: r.supportEmail ?? null,
  };
}
