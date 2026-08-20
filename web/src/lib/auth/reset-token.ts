/**
 * Jetons de réinitialisation de mot de passe.
 *
 * Un lien de réinitialisation est une clé de la boutique : le temps de sa validité, il permet
 * d'entrer sans connaître le mot de passe. Trois règles en découlent.
 *
 *   1. Imprévisible. 32 octets tirés du générateur cryptographique du système, pas de compteur ni
 *      d'horodatage : rien qui puisse se deviner à partir d'un autre lien.
 *   2. Jamais stocké en clair. Seule son empreinte SHA-256 entre en base — quelqu'un qui lirait la
 *      table ne pourrait pas fabriquer de lien valide. SHA-256 suffit là où un mot de passe exige
 *      bcrypt : il n'y a pas de « mot de passe faible » à retrouver par force brute derrière 32
 *      octets aléatoires.
 *   3. Éphémère et à usage unique. Une heure, une seule utilisation, et toute nouvelle demande
 *      périme les précédentes — un lien oublié dans une boîte mail ne doit pas rester une clé.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordResetTokens } from "@/db/schema";

export const VALIDITE_MINUTES = 60;

export function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/**
 * Crée un jeton pour ce compte et périme tous les précédents. Renvoie le jeton en clair : c'est la
 * seule et unique fois où il existe sous cette forme.
 */
export async function creerJeton(userId: string, ip: string | null): Promise<string> {
  // Une demande annule les précédentes. Sinon, chaque demande répétée ajouterait une clé valide de
  // plus, et la plus ancienne survivrait à la plus récente.
  await db
    .update(passwordResetTokens)
    .set({ utiliseLe: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.utiliseLe)));

  const jeton = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    userId,
    jetonHash: empreinte(jeton),
    expireLe: new Date(Date.now() + VALIDITE_MINUTES * 60_000),
    demandeIp: ip,
  });
  return jeton;
}

export type JetonValide = {
  tokenId: string;
  userId: string;
  nom: string;
  email: string;
};

export type RaisonRefus = "INTROUVABLE" | "EXPIRE" | "UTILISE" | "COMPTE_FERME";

export type Verification = { ok: true; jeton: JetonValide } | { ok: false; raison: RaisonRefus };

/**
 * Vérifie un jeton présenté par un visiteur. Ne modifie rien : la consommation se fait à part, au
 * moment où le nouveau mot de passe est réellement enregistré. Cela permet à la page d'afficher un
 * message clair avant le formulaire, sans brûler le jeton en le regardant.
 */
export async function verifierJeton(jetonClair: string): Promise<Verification> {
  if (!jetonClair || jetonClair.length < 20) return { ok: false, raison: "INTROUVABLE" };

  const hash = empreinte(jetonClair);
  const [ligne] = await db.execute<Record<string, unknown>>(sql`
    select t.id, t.user_id, t.jeton_hash, t.expire_le, t.utilise_le,
           u.nom, u.email, u.desactive_le
    from password_reset_tokens t
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
      nom: String(ligne.nom),
      email: String(ligne.email),
    },
  };
}

/**
 * Marque le jeton comme utilisé, mais seulement s'il ne l'était pas déjà.
 *
 * La condition `utilise_le is null` fait partie de l'instruction : deux requêtes simultanées
 * portant le même lien ne peuvent pas réussir toutes les deux, c'est la base qui tranche. Renvoie
 * `false` si le jeton avait déjà été consommé entre-temps.
 */
export async function consommerJeton(tokenId: string): Promise<boolean> {
  const lignes = await db.execute<Record<string, unknown>>(sql`
    update password_reset_tokens
       set utilise_le = now()
     where id = ${tokenId} and utilise_le is null
    returning id
  `);
  return lignes.length > 0;
}

export function messageJetonInvalide(raison: RaisonRefus): string {
  switch (raison) {
    case "EXPIRE":
      return `Ce lien a expiré — il n'était valable que ${VALIDITE_MINUTES} minutes. Demandez-en un nouveau.`;
    case "UTILISE":
      return "Ce lien a déjà servi. Demandez-en un nouveau si vous devez encore changer votre mot de passe.";
    case "COMPTE_FERME":
      return "Ce compte a été supprimé et ne peut plus être utilisé.";
    default:
      return "Ce lien n'est pas valable. Il a peut-être été tronqué en chemin — demandez-en un nouveau.";
  }
}

/** Périme toutes les sessions ouvertes du compte, sur tous ses appareils. */
export async function deconnecterTousLesAppareils(userId: string): Promise<void> {
  await db.execute(sql`update devices set revoque = true where user_id = ${userId} and revoque = false`);
}

/** Retire les jetons périmés depuis plus d'un jour. Appelé après un changement réussi. */
export async function purgerJetons(): Promise<void> {
  try {
    await db.execute(sql`delete from password_reset_tokens where expire_le < now() - interval '1 day'`);
  } catch (e) {
    console.error("purge des jetons de réinitialisation :", e instanceof Error ? e.message : e);
  }
}
