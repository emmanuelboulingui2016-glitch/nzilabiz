import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const COOKIE_NAME = "nzilabiz_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET manquant — copiez .env.example en .env et renseignez-le.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  storeId: string;
  role: "PATRON" | "GERANT" | "VENDEUR";
  deviceId?: string;
  /**
   * `null` pour un employé qui se connecte par téléphone : la plupart des vendeurs n'ont pas
   * d'adresse. `isSuperAdminEmail` traite déjà `null` comme « pas administrateur », ce qui est la
   * réponse voulue — un compte sans adresse ne peut pas être celui d'un administrateur de la
   * plateforme, dont la liste est faite d'adresses.
   */
  email: string | null;
  nom: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Réservé au HTTPS en production. Exception assumée : le mode présentation, où l'application
    // tourne sur un ordinateur du réseau local en http://192.168.x.x. Sans cette exception le
    // navigateur du téléphone refuse silencieusement le cookie et la connexion échoue sans
    // message. MODE_PRESENTATION doit rester absent de toute vraie mise en ligne.
    secure: process.env.NODE_ENV === "production" && process.env.MODE_PRESENTATION !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Vérifie que l'accès porté par ce jeton est toujours ouvert, côté base.
 *
 * Un jeton JWT est autonome : une fois signé, il reste valable jusqu'à son échéance, trente jours
 * plus tard. Rien dans le jeton ne peut donc traduire une révocation décidée après coup. Or
 * l'application en propose trois : « Déconnecter » un appareil dans Paramètres → Sécurité,
 * « Révoquer » un appareil perdu ou volé dans Synchronisation, et la fermeture d'un compte. Les
 * trois écrivent bien en base et l'interface affiche « Déconnecté » — mais tant que personne ne
 * relit cette information au moment de valider la session, l'appareil révoqué continue d'entrer.
 * Un téléphone volé gardait ainsi l'accès à la boutique pendant un mois, avec un écran affirmant
 * le contraire.
 *
 * Depuis le réseau Entreprise, cette vérification porte aussi sur la **boutique** inscrite dans le
 * jeton. Un compte peut basculer d'une boutique à l'autre, et la bascule réécrit `storeId` dans le
 * jeton ; sans relecture, un rattachement retiré ensuite laisserait ce jeton ouvrir la boutique
 * pendant trente jours encore. La boutique d'origine du compte (`users.store_id`) et ses
 * rattachements (`store_memberships`) sont donc les seules valeurs acceptées.
 *
 * Coût : une lecture indexée par requête HTTP, dédupliquée par `cache()` — les composants serveur
 * appellent `getSession()` plusieurs fois par page, la base n'est interrogée qu'une. Le contrôle de
 * boutique tient dans la même instruction : aucun aller-retour supplémentaire.
 *
 * En cas de panne de base, on laisse passer plutôt que de déconnecter tout le monde : c'est le
 * choix déjà retenu pour la limitation de débit. Une base indisponible ne permet de toute façon
 * aucune action dans l'application.
 */
async function accesRevoque(p: SessionPayload): Promise<boolean> {
  try {
    const [ligne] = await db.execute<Record<string, unknown>>(
      p.deviceId
        ? sql`
            select
              (u.desactive_le is not null) as compte_ferme,
              (u.store_id <> ${p.storeId} and not exists (
                select 1 from store_memberships m
                where m.user_id = u.id and m.store_id = ${p.storeId}
              )) as boutique_hors_acces,
              not exists (
                select 1 from devices d
                where d.id = ${p.deviceId} and d.user_id = u.id and d.revoque = false
              ) as appareil_hors_service
            from users u
            where u.id = ${p.userId}
          `
        : sql`
            select
              (u.desactive_le is not null) as compte_ferme,
              (u.store_id <> ${p.storeId} and not exists (
                select 1 from store_memberships m
                where m.user_id = u.id and m.store_id = ${p.storeId}
              )) as boutique_hors_acces,
              false as appareil_hors_service
            from users u
            where u.id = ${p.userId}
          `
    );
    // Aucune ligne : le compte a été supprimé avec sa boutique (suppression en cascade).
    if (!ligne) return true;
    return (
      Boolean(ligne.compte_ferme) ||
      Boolean(ligne.boutique_hors_acces) ||
      Boolean(ligne.appareil_hors_service)
    );
  } catch (e) {
    console.error("session : vérification de révocation impossible —", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Décode et valide un jeton. Mémorisé pour la durée de la requête : `getSession()` est appelé par
 * la mise en page, la page, puis chaque route qu'elle déclenche.
 */
const sessionDepuisJeton = cache(async (token: string): Promise<SessionPayload | null> => {
  let payload: SessionPayload;
  try {
    const resultat = await jwtVerify(token, getSecretKey());
    payload = resultat.payload as unknown as SessionPayload;
  } catch {
    return null;
  }
  if (!payload?.userId) return null;
  return (await accesRevoque(payload)) ? null : payload;
});

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return sessionDepuisJeton(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
