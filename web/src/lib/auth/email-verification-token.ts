/**
 * Jetons de vérification d'adresse e-mail — inscription et changement d'adresse de la boutique.
 *
 * Même mécanisme que les jetons de réinitialisation de mot de passe (voir reset-token.ts, à lire
 * en premier) et volontairement identique : imprévisible (32 octets du générateur cryptographique
 * du système), jamais stocké en clair (seule l'empreinte SHA-256 entre en base), éphémère et à
 * usage unique. Un mécanisme plus faible à côté d'un bon n'aurait aucune justification.
 *
 * Les règles pures (hachage, durée de validité, messages) vivent dans
 * `email-verification-token-regles.ts`, sans dépendance à la base — voir ce fichier pour le detail
 * et la raison de la séparation. Celui-ci ne porte que ce qui touche réellement `db`.
 *
 * Deux types, portés par `emailVerificationTokens.type` (voir le schéma pour le détail des deux
 * usages) :
 *   - INSCRIPTION : confirme l'adresse `users.email` courante. Ne conditionne JAMAIS la connexion
 *     — c'est un état affiché (bandeau discret), pas un verrou. Voir le commentaire sur
 *     `users.emailVerifieLe` dans le schéma.
 *   - CHANGEMENT_EMAIL : confirme `users.nouvelEmail`. Sa consommation, elle, déclenche bien la
 *     bascule vers `users.email` — voir /api/auth/verifier-email.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { emailVerificationTokens } from "@/db/schema";
import {
  dateExpiration,
  empreinte,
  type TypeJetonVerification,
  type VerificationJetonVerification,
} from "./email-verification-token-regles";

export {
  VALIDITE_MINUTES,
  dateExpiration,
  empreinte,
  messageJetonVerificationInvalide,
  type TypeJetonVerification,
  type JetonVerificationValide,
  type RaisonRefusVerification,
  type VerificationJetonVerification,
} from "./email-verification-token-regles";

/**
 * Crée un jeton pour ce compte et périme les précédents DU MÊME TYPE : un renvoi de l'e-mail
 * d'inscription ne doit pas laisser vivre un lien de changement d'adresse en attente, et
 * inversement — ce sont deux demandes indépendantes. Renvoie le jeton en clair, la seule fois où
 * il existe sous cette forme.
 */
export async function creerJetonVerification(
  userId: string,
  type: TypeJetonVerification,
  email: string,
  ip: string | null
): Promise<string> {
  await db
    .update(emailVerificationTokens)
    .set({ utiliseLe: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        eq(emailVerificationTokens.type, type),
        isNull(emailVerificationTokens.utiliseLe)
      )
    );

  const jeton = randomBytes(32).toString("base64url");
  await db.insert(emailVerificationTokens).values({
    userId,
    type,
    email,
    jetonHash: empreinte(jeton),
    expireLe: dateExpiration(),
    demandeIp: ip,
  });
  return jeton;
}

/**
 * Vérifie un jeton présenté par un visiteur, sans le consommer : la page qui affiche le lien peut
 * ainsi montrer un message clair avant que le commerçant ne clique sur le bouton de confirmation,
 * sans brûler le jeton en le regardant.
 */
export async function verifierJetonVerification(jetonClair: string): Promise<VerificationJetonVerification> {
  if (!jetonClair || jetonClair.length < 20) return { ok: false, raison: "INTROUVABLE" };

  const hash = empreinte(jetonClair);
  const [ligne] = await db.execute<Record<string, unknown>>(sql`
    select t.id, t.user_id, t.type, t.email, t.jeton_hash, t.expire_le, t.utilise_le,
           u.nom, u.desactive_le
    from email_verification_tokens t
    join users u on u.id = t.user_id
    where t.jeton_hash = ${hash}
    limit 1
  `);

  if (!ligne) return { ok: false, raison: "INTROUVABLE" };

  // La recherche s'est faite sur l'empreinte, donc en temps constant du point de vue de l'index.
  // Cette seconde comparaison protège l'égalité elle-même : elle ne s'interrompt pas au premier
  // caractère différent, et ne laisse donc pas mesurer à quel point une tentative approchait.
  const attendu = Buffer.from(String(ligne.jeton_hash), "utf8");
  const fourni = Buffer.from(hash, "utf8");
  if (attendu.length !== fourni.length || !timingSafeEqual(attendu, fourni)) {
    return { ok: false, raison: "INTROUVABLE" };
  }

  if (ligne.utilise_le) return { ok: false, raison: "UTILISE" };
  if (new Date(String(ligne.expire_le)) <= new Date()) return { ok: false, raison: "EXPIRE" };
  if (ligne.desactive_le) return { ok: false, raison: "COMPTE_FERME" };

  return {
    ok: true,
    jeton: {
      tokenId: String(ligne.id),
      userId: String(ligne.user_id),
      type: ligne.type as TypeJetonVerification,
      email: String(ligne.email),
      nom: String(ligne.nom),
    },
  };
}

/**
 * Marque le jeton comme utilisé, mais seulement s'il ne l'était pas déjà. La condition
 * `utilise_le is null` fait partie de l'instruction : deux requêtes simultanées portant le même
 * lien ne peuvent pas réussir toutes les deux, c'est la base qui tranche.
 */
export async function consommerJetonVerification(tokenId: string): Promise<boolean> {
  const lignes = await db.execute<Record<string, unknown>>(sql`
    update email_verification_tokens
       set utilise_le = now()
     where id = ${tokenId} and utilise_le is null
    returning id
  `);
  return lignes.length > 0;
}

/** Retire les jetons périmés depuis plus d'un jour. Appelé au hasard après une consommation réussie. */
export async function purgerJetonsVerification(): Promise<void> {
  try {
    await db.execute(sql`delete from email_verification_tokens where expire_le < now() - interval '1 day'`);
  } catch (e) {
    console.error("purge des jetons de vérification d'adresse :", e instanceof Error ? e.message : e);
  }
}
