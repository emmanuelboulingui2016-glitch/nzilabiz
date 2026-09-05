import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { permissionsFor, resoudrePermissions, type Permission, type PermissionOverride, type Role } from "@/lib/auth/rbac";
import { resoudrePeut } from "@/lib/auth/peut-logic";

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
 * Vérifie que l'accès porté par ce jeton est toujours ouvert, côté base, et calcule au passage ses
 * permissions effectives (matrice du rôle + dérogations individuelles actives — §14,
 * employeePermissionOverrides, voir rbac.ts::resoudrePermissions).
 *
 * Un jeton JWT est autonome : une fois signé, il reste valable jusqu'à son échéance, trente jours
 * plus tard. Rien dans le jeton ne peut donc traduire une décision prise après coup. Or
 * l'application en connaît plusieurs : « Déconnecter » un appareil dans Paramètres → Sécurité,
 * « Révoquer » un appareil perdu ou volé dans Synchronisation, la fermeture d'un compte — et,
 * depuis le chantier des dérogations, le patron qui accorde ou retire un droit précis à un employé.
 * Les trois premières écrivent bien en base et l'interface affiche « Déconnecté » ; la quatrième
 * affiche « Retiré ». Mais tant que personne ne relit cette information au moment de valider la
 * session, rien de tout cela ne bloque réellement : un appareil révoqué continuait d'entrer, et un
 * droit retiré ne retirait rien à l'appel API correspondant.
 *
 * Depuis le réseau Entreprise, cette vérification porte aussi sur la **boutique** inscrite dans le
 * jeton. Un compte peut basculer d'une boutique à l'autre, et la bascule réécrit `storeId` dans le
 * jeton ; sans relecture, un rattachement retiré ensuite laisserait ce jeton ouvrir la boutique
 * pendant trente jours encore. La boutique d'origine du compte (`users.store_id`) et ses
 * rattachements (`store_memberships`) sont donc les seules valeurs acceptées.
 *
 * DÉCISION D'ARCHITECTURE — pourquoi les dérogations sont lues ICI et non dans une requête séparée :
 * la première version de ce chantier isolait la lecture des dérogations dans sa propre requête,
 * `permissionsEffectives()`, justement pour ne pas faire payer un aller-retour supplémentaire aux
 * ~60 routes qui n'appelaient que `getSession()`. Ce raisonnement tenait tant que les dérogations
 * n'étaient branchées que sur deux écrans. Il ne tient plus une fois `peut()` généralisé à
 * l'ensemble des routes API : CHAQUE requête HTTP aurait alors payé DEUX allers-retours en base
 * (celui-ci, plus celui des dérogations) au lieu d'un seul — un coût direct sur le temps de réponse
 * dans une application où les requêtes ne peuvent jamais être parallélisées (pooler Supavisor en
 * mode transaction, voir src/db/client.ts). La jointure ci-dessous ramène ce coût à un seul
 * aller-retour, quelle que soit la boutique : la sous-requête sur `employee_permission_overrides`
 * est indexée sur `user_id` et renvoie un tableau vide pour l'immense majorité des comptes, qui
 * n'ont jamais reçu de dérogation — son coût est négligeable à côté de celui, déjà payé, de la
 * jointure sur `store_memberships`.
 *
 * Coût final : toujours **une seule** lecture indexée par requête HTTP, dédupliquée par `cache()` —
 * les composants serveur appellent `getSession()` plusieurs fois par page, la base n'est interrogée
 * qu'une fois, et cette unique lecture porte maintenant la révocation ET les permissions effectives.
 *
 * En cas de panne de base, on laisse passer plutôt que de déconnecter tout le monde (choix déjà
 * retenu pour la limitation de débit — une base indisponible ne permet de toute façon aucune action
 * dans l'application), mais les permissions retombent sur la matrice du rôle seule : jamais plus
 * permissif que ce que la panne ne devrait laisser passer.
 */
async function accesEtPermissions(p: SessionPayload): Promise<{ revoque: boolean; permissions: Permission[] }> {
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
              ) as appareil_hors_service,
              coalesce(
                (
                  select json_agg(json_build_object('permission', o.permission, 'action', o.action, 'creeLe', o.cree_le))
                  from employee_permission_overrides o
                  where o.user_id = u.id and o.revoque_le is null
                ),
                '[]'::json
              ) as derogations
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
              false as appareil_hors_service,
              coalesce(
                (
                  select json_agg(json_build_object('permission', o.permission, 'action', o.action, 'creeLe', o.cree_le))
                  from employee_permission_overrides o
                  where o.user_id = u.id and o.revoque_le is null
                ),
                '[]'::json
              ) as derogations
            from users u
            where u.id = ${p.userId}
          `
    );
    // Aucune ligne : le compte a été supprimé avec sa boutique (suppression en cascade).
    if (!ligne) return { revoque: true, permissions: [] };
    const revoque =
      Boolean(ligne.compte_ferme) || Boolean(ligne.boutique_hors_acces) || Boolean(ligne.appareil_hors_service);
    if (revoque) return { revoque: true, permissions: [] };
    return { revoque: false, permissions: resoudrePermissions(p.role, parserDerogations(ligne.derogations)) };
  } catch (e) {
    console.error("session : vérification de révocation/permissions impossible —", e instanceof Error ? e.message : e);
    // Panne de base : on laisse passer (voir plus haut), mais sans dérogation — la matrice du rôle
    // seule, jamais plus permissif que ce que la panne ne devrait laisser passer.
    return { revoque: false, permissions: permissionsFor(p.role) };
  }
}

/** Convertit le tableau JSON renvoyé par `json_agg` (voir requête ci-dessus) en dérogations typées. */
function parserDerogations(brut: unknown): PermissionOverride[] {
  if (!Array.isArray(brut)) return [];
  return brut.map((l) => {
    const ligne = l as Record<string, unknown>;
    return {
      permission: String(ligne.permission) as Permission,
      action: (ligne.action === "ACCORDEE" ? "ACCORDEE" : "RETIREE") as "ACCORDEE" | "RETIREE",
      creeLe: new Date(String(ligne.creeLe)),
    };
  });
}

/**
 * Session telle que renvoyée par `getSession()` : le contenu du jeton, plus les permissions
 * effectives déjà résolues (matrice du rôle + dérogations actives) par `accesEtPermissions`
 * ci-dessus. C'est ce type, et non `SessionPayload`, qu'attend `peut()` — voir plus bas.
 */
export type Session = SessionPayload & { permissions: Permission[] };

/**
 * Décode et valide un jeton. Mémorisé pour la durée de la requête : `getSession()` est appelé par
 * la mise en page, la page, puis chaque route qu'elle déclenche.
 */
const sessionDepuisJeton = cache(async (token: string): Promise<Session | null> => {
  let payload: SessionPayload;
  try {
    // Algorithme épinglé à HS256 (celui utilisé par createSessionToken ci-dessus) : la clé étant
    // symétrique, jose refuse déjà nativement `alg: none` ou une confusion RS256/HS256, mais
    // l'épingler explicitement coûte une ligne et documente l'intention pour le prochain lecteur.
    const resultat = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    payload = resultat.payload as unknown as SessionPayload;
  } catch {
    return null;
  }
  if (!payload?.userId) return null;
  const { revoque, permissions } = await accesEtPermissions(payload);
  if (revoque) return null;
  return { ...payload, permissions };
});

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return sessionDepuisJeton(token);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/**
 * Dérogations actives d'un utilisateur qui n'est PAS celui de la session courante — cas rare,
 * mémorisé par `cache()` comme le reste de ce fichier (un seul aller-retour même appelée plusieurs
 * fois pour le même utilisateur pendant la même requête HTTP), mais volontairement tenu à l'écart
 * de la fusion ci-dessus : il ne concerne que /api/vendre/sync (voir `peut()` plus bas), où le droit
 * à vérifier est celui du vendeur qui a réellement encaissé la vente hors-ligne, jamais celui de la
 * session qui déclenche la resynchro. Fusionner ce cas dans `accesEtPermissions` n'aurait rien
 * économisé : cette requête reste nécessaire uniquement quand `payload.userId` diffère de la
 * session, c'est-à-dire déjà un chemin exceptionnel qui paie sa propre requête de résolution de rôle
 * (voir sync/route.ts).
 */
const derogationsActivesDeUtilisateur = cache(async (userId: string): Promise<PermissionOverride[]> => {
  try {
    const lignes = await db.execute<Record<string, unknown>>(sql`
      select permission, action, cree_le
      from employee_permission_overrides
      where user_id = ${userId} and revoque_le is null
    `);
    return lignes.map((l) => ({
      permission: String(l.permission) as Permission,
      action: (l.action === "ACCORDEE" ? "ACCORDEE" : "RETIREE") as "ACCORDEE" | "RETIREE",
      creeLe: new Date(String(l.cree_le)),
    }));
  } catch (e) {
    // Même choix qu'ailleurs dans ce fichier : une lecture qui échoue ne doit pas faire tomber la
    // requête pour une fonctionnalité annexe. On retombe sur « aucune dérogation », c'est-à-dire le
    // comportement de la matrice de rôle seule — jamais plus permissif que prévu.
    console.error("session : dérogations de permissions illisibles —", e instanceof Error ? e.message : e);
    return [];
  }
});

/**
 * Permissions effectives d'un utilisateur qui n'est pas celui de la session courante — matrice de
 * son rôle (rbac.ts) + ses dérogations actives, relues fraîches en base. Réservé au cas décrit
 * ci-dessus (`derogationsActivesDeUtilisateur`) : dans tout le reste de l'application, préférer
 * `peut(session, permission)`, qui n'ajoute aucun aller-retour puisque les permissions de la session
 * courante sont déjà résolues par `accesEtPermissions`.
 */
export async function permissionsEffectivesPour(userId: string, role: Role): Promise<Permission[]> {
  const overrides = await derogationsActivesDeUtilisateur(userId);
  return resoudrePermissions(role, overrides);
}

/**
 * Point d'entrée UNIQUE pour poser la question « cette personne a-t-elle le droit ? », côté serveur.
 * Remplace les 111 appels dispersés à `can(session.role, permission)` qui ignoraient les
 * dérogations individuelles (§14) : un droit retiré par le patron s'affichait comme retiré à
 * l'écran, mais ne bloquait rien à l'appel API réel — ce chantier corrige exactement ça.
 *
 * Deux façons de l'appeler, une seule fonction :
 *   - `peut(session, permission)` — le cas courant, largement majoritaire : vérifie le droit de la
 *     personne connectée. Aucun aller-retour supplémentaire, les permissions sont déjà résolues sur
 *     `session` par `getSession()`.
 *   - `peut({ userId, role }, permission)` — cas explicitement réservé à /api/vendre/sync : le droit
 *     de négocier un prix au comptoir (`vendre.prix.modifier`) doit s'apprécier sur le vendeur qui a
 *     RÉELLEMENT encaissé la vente hors-ligne, pas sur la session qui déclenche la resynchro plus
 *     tard depuis un appareil partagé — potentiellement un collègue sans ce droit. Voir le
 *     commentaire de sync/route.ts pour le raisonnement complet.
 *
 * `session` (ou l'acteur) peut être `null`/`undefined` : refuse toujours plutôt que de lever une
 * exception, pour que `peut(await getSession(), ...)` reste sûr même avant toute vérification
 * d'authentification.
 */
export async function peut(
  acteur: Session | { userId: string; role: Role } | null | undefined,
  permission: Permission
): Promise<boolean> {
  if (!acteur) return false;
  if ("permissions" in acteur) return resoudrePeut(acteur, permission);
  const permissions = await permissionsEffectivesPour(acteur.userId, acteur.role);
  return resoudrePeut({ permissions }, permission);
}
