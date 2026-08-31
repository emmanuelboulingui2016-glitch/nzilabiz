/**
 * Accès d'une boutique selon son abonnement — source unique de vérité.
 *
 * Jusqu'ici, `plan`, `essaiExpireLe` et `abonnementExpireLe` étaient écrits en base et affichés dans
 * l'écran Abonnement, mais **aucune ligne de code ne les relisait pour refuser quoi que ce soit**.
 * Une boutique dont l'essai était terminé gardait l'accès complet, indéfiniment.
 *
 * Deux garde-fous sont inscrits dans les règles elles-mêmes, et non laissés à la vigilance de
 * l'appelant, parce qu'une erreur ici met un commerçant à l'arrêt en pleine journée de vente :
 *
 *   - la boutique d'un administrateur de la plateforme n'est jamais bloquée ; on ne peut pas
 *     s'enfermer dehors ;
 *   - une boutique du programme de test reste ouverte tant que le programme lui-même n'est pas
 *     terminé, quelle que soit la date d'essai inscrite sur sa fiche.
 *
 * Une lecture indexée par requête HTTP, mémorisée par `cache()` — même approche que
 * `src/lib/auth/session.ts`, où le calque, la page et chaque route appellent la même vérification.
 */

import { cache } from "react";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";

export type RaisonBlocage = "ESSAI_EXPIRE" | "ABONNEMENT_EXPIRE";

export type EtatBoutique = {
  actif: boolean;
  raison: RaisonBlocage | null;
  /** Échéance qui s'applique à cette boutique, ou null si elle n'en a pas. */
  expireLe: Date | null;
  /** Négatif une fois l'échéance passée. `null` quand il n'y a pas d'échéance. */
  joursRestants: number | null;
  plan: string;
  programmeTest: boolean;
  /**
   * Boutique qui porte le contrat : elle-même, ou sa maison mère si elle est rattachée à un
   * réseau Entreprise. `null` seulement quand l'état n'a pas pu être lu.
   */
  contratId: string | null;
  /** Cette boutique est rattachée à une maison mère : elle ne porte pas son propre abonnement. */
  rattachee: boolean;
};

const ACTIF_SANS_ECHEANCE: EtatBoutique = {
  actif: true,
  raison: null,
  expireLe: null,
  joursRestants: null,
  plan: "ESSAI",
  programmeTest: false,
  contratId: null,
  rattachee: false,
};

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * État d'une boutique. Ne dépend pas de la session : appelable depuis une route qui a déjà son
 * `storeId`.
 */
export const etatBoutique = cache(async (storeId: string): Promise<EtatBoutique> => {
  try {
    // `coalesce(maison_mere_id, id)` désigne la boutique qui porte le contrat. Pour une boutique
    // indépendante, c'est elle-même ; pour une boutique d'un réseau Entreprise, c'est la maison
    // mère. Une seule jointure, et la règle tient en une expression : il n'existe aucun chemin par
    // lequel une boutique rattachée serait jugée sur ses propres dates, restées vides.
    const [ligne] = await db.execute<Record<string, unknown>>(sql`
      with cible as (
        select coalesce(s.maison_mere_id, s.id) as contrat_id, (s.maison_mere_id is not null) as rattachee
        from stores s
        where s.id = ${storeId}
      )
      select
        c.contrat_id,
        c.rattachee,
        p.plan,
        p.programme_test,
        p.essai_expire_le,
        p.abonnement_expire_le,
        -- Le programme de test est global : une boutique testeuse suit sa date, pas la sienne.
        (select test_lien_expire_le from platform_settings limit 1) as programme_expire_le
      from cible c
      join stores p on p.id = c.contrat_id
    `);

    // Boutique introuvable : ce n'est pas à cette fonction de trancher un cas qui relève de
    // l'authentification. On laisse passer, la session s'en occupe.
    if (!ligne) return ACTIF_SANS_ECHEANCE;

    const plan = String(ligne.plan ?? "ESSAI");
    const programmeTest = ligne.programme_test === true;
    const contratId = ligne.contrat_id ? String(ligne.contrat_id) : storeId;
    const rattachee = ligne.rattachee === true;
    const maintenant = Date.now();

    const dateOuNull = (v: unknown): Date | null => (v ? new Date(String(v)) : null);

    // Programme de test : gratuit et complet jusqu'à la date fixée dans l'administration. Sans date,
    // le programme n'a pas de fin — c'est un choix explicite de l'administrateur, pas un oubli.
    if (programmeTest) {
      const finProgramme = dateOuNull(ligne.programme_expire_le);
      if (!finProgramme || finProgramme.getTime() > maintenant) {
        return {
          actif: true,
          raison: null,
          expireLe: finProgramme,
          joursRestants: finProgramme ? Math.ceil((finProgramme.getTime() - maintenant) / JOUR_MS) : null,
          plan,
          programmeTest: true,
          contratId,
          rattachee,
        };
      }
    }

    const enEssai = plan === "ESSAI";
    const echeance = dateOuNull(enEssai ? ligne.essai_expire_le : ligne.abonnement_expire_le);

    // Pas d'échéance renseignée : on n'invente pas une date de fin. Bloquer une boutique sur une
    // colonne vide serait la punir d'un défaut de configuration qui n'est pas le sien.
    if (!echeance) return { ...ACTIF_SANS_ECHEANCE, plan, programmeTest, contratId, rattachee };

    const restant = Math.ceil((echeance.getTime() - maintenant) / JOUR_MS);
    const expire = echeance.getTime() <= maintenant;

    return {
      actif: !expire,
      raison: expire ? (enEssai ? "ESSAI_EXPIRE" : "ABONNEMENT_EXPIRE") : null,
      expireLe: echeance,
      joursRestants: restant,
      plan,
      programmeTest,
      contratId,
      rattachee,
    };
  } catch (e) {
    // Une panne de base ne doit pas fermer les boutiques : sans elle, l'application ne peut de toute
    // façon rien faire. Même choix que la limitation de débit et la vérification de révocation.
    console.error("abonnement : état illisible —", e instanceof Error ? e.message : e);
    return ACTIF_SANS_ECHEANCE;
  }
});

/**
 * État de la boutique de la session courante, en tenant compte du statut d'administrateur de
 * plateforme — qui n'est jamais bloqué.
 */
export async function etatBoutiqueCourante(): Promise<EtatBoutique | null> {
  const session = await getSession();
  if (!session) return null;

  const etat = await etatBoutique(session.storeId);

  // Un administrateur de la plateforme n'est jamais bloqué — on ne peut pas s'enfermer dehors.
  // On force l'accès sans effacer le reste : renvoyer un état synthétique ferait croire à sa
  // boutique qu'elle est en essai, et les écrans qui lisent la formule (réseau Entreprise,
  // page Abonnement) mentiraient.
  if (isSuperAdminEmail(session.email)) return { ...etat, actif: true, raison: null };

  return etat;
}

export function messageBlocage(raison: RaisonBlocage): string {
  return raison === "ESSAI_EXPIRE"
    ? "Votre période d'essai est terminée."
    : "Votre abonnement est arrivé à échéance.";
}

/**
 * Garde pour les routes qui écrivent. Renvoie une réponse 402 si la boutique est bloquée, `null`
 * sinon — à placer juste après la vérification de session :
 *
 *     const bloque = await bloquerSiExpiree();
 *     if (bloque) return bloque;
 *
 * 402 « Payment Required » plutôt que 403 : ce n'est pas un défaut de droits, c'est une échéance.
 * L'interface peut ainsi distinguer les deux et afficher le bon message.
 */
export async function bloquerSiExpiree(): Promise<NextResponse | null> {
  const etat = await etatBoutiqueCourante();
  if (!etat || etat.actif) return null;

  return NextResponse.json(
    {
      error: `${messageBlocage(etat.raison!)} Contactez le support pour réactiver votre boutique.`,
      code: "ABONNEMENT_EXPIRE",
    },
    { status: 402 }
  );
}
