import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { db } from "@/db/client";
import { users, stores, devices, notificationSettings } from "@/db/schema";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { deviceNameFromUserAgent } from "@/lib/device-name";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { googleConfigure, GOOGLE_STATE_COOKIE } from "@/lib/auth/google";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Retour du parcours OAuth2 de Google. C'est un chemin d'authentification à part entière : il doit
// offrir les mêmes garanties que /api/auth/login, pas moins.
//
// Clés publiques de Google, mises en cache et renouvelées par jose. La signature de l'id_token est
// donc vérifiée localement : même si la réponse était altérée en chemin, elle serait rejetée.
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// Même essai que l'inscription par e-mail. Sans cette date, une boutique créée par Google n'aurait
// aucune fin d'essai : elle passerait au travers du jour où l'abonnement sera réellement appliqué.
const DUREE_ESSAI_MS = 15 * 24 * 60 * 60 * 1000;

// L'échange du code contre un jeton fait un appel sortant vers Google. Sans garde-fou, un script
// pourrait s'en servir pour nous faire marteler leur API depuis nos serveurs.
const LIMITE = { limite: 20, fenetreMs: 10 * 60_000, blocageMs: 10 * 60_000 };

export async function GET(request: Request) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const echec = (raison: string) => NextResponse.redirect(new URL(`/connexion?error=${raison}`, appUrl));

  // Le bouton n'est plus affiché quand la configuration manque, mais l'URL reste atteignable à la
  // main : on ne s'appuie jamais sur l'interface pour fermer une porte.
  if (!googleConfigure()) return echec("google_non_configure");

  if (!(await rateLimit(`google:ip:${clientIp(request)}`, LIMITE)).ok) {
    return echec("google_trop_de_tentatives");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Google renvoie ?error=access_denied quand la personne annule sur son écran. Ce n'est pas une
  // panne : inutile de l'inquiéter avec un message d'échec.
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/connexion", appUrl));

  // Le `state` prouve que ce retour correspond bien à un départ initié depuis ce navigateur : sans
  // lui, un tiers pourrait provoquer une connexion à son propre compte à l'insu du visiteur (CSRF
  // de connexion).
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${GOOGLE_STATE_COOKIE}=`))
    ?.slice(GOOGLE_STATE_COOKIE.length + 1);

  if (!code || !state || !cookieState || state !== cookieState) {
    return echec("google_etat_invalide");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  }).catch(() => null);

  if (!tokenRes?.ok) return echec("google_echec_token");
  const tokenJson = (await tokenRes.json().catch(() => null)) as { id_token?: string } | null;
  if (!tokenJson?.id_token) return echec("google_echec_token");

  let payload;
  try {
    ({ payload } = await jwtVerify(tokenJson.id_token, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    }));
  } catch {
    return echec("google_jeton_invalide");
  }

  // Adresse ramenée en minuscules : c'est la forme sous laquelle les comptes sont enregistrés.
  // Sans cette normalisation, « Jean@Gmail.com » créé par le formulaire et « jean@gmail.com »
  // renvoyé par Google deviendraient deux comptes et deux boutiques distinctes.
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
  if (!email) return echec("google_sans_email");

  // Le point le plus important de cette route. Google peut délivrer un jeton portant une adresse
  // qu'il n'a PAS vérifiée (certains comptes d'organisation). Accepter cette adresse reviendrait à
  // laisser n'importe qui se déclarer propriétaire d'une adresse quelconque : comme le code
  // ci-dessous rattache un compte existant à l'identité Google présentée, ce serait la prise de
  // contrôle de la boutique de quelqu'un d'autre. On n'accepte que le cas prouvé.
  const verifie = payload.email_verified;
  if (verifie !== true && verifie !== "true") return echec("google_email_non_verifie");

  const nom = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email;
  const googleId = payload.sub as string;

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user) {
    // Même règle qu'à l'inscription : une adresse d'administrateur de la plateforme ne se
    // réclame pas par un parcours public. Ici l'adresse est prouvée, mais le compte superadmin se
    // crée délibérément — pas au détour d'une connexion, avec une boutique « Ma boutique ».
    if (isSuperAdminEmail(email)) return echec("google_adresse_reservee");

    // Nouveau compte via Google : boutique créée avec un nom provisoire, à renommer dans
    // Paramètres > Boutique (simplification assumée pour ne pas bloquer sur un écran intermédiaire).
    // Écritures séquentielles : ce projet ne lance jamais plusieurs requêtes en parallèle sur le
    // pooler en mode transaction (voir README).
    const [store] = await db
      .insert(stores)
      .values({ nom: "Ma boutique", plan: "ESSAI", essaiExpireLe: new Date(Date.now() + DUREE_ESSAI_MS) })
      .returning();
    await db.insert(notificationSettings).values({ storeId: store.id });
    [user] = await db.insert(users).values({ storeId: store.id, nom, email, googleId, role: "PATRON" }).returning();
  } else {
    // Compte supprimé par son titulaire : la ligne subsiste pour l'historique des ventes, mais elle
    // ne doit plus ouvrir de session — quel que soit le chemin emprunté.
    if (user.desactiveLe) return echec("google_compte_ferme");

    // Première connexion Google d'un compte créé par mot de passe : on rattache les deux. Légitime
    // parce que Google vient de prouver, ci-dessus, que la personne possède bien cette adresse.
    // Un seul UPDATE : le rattachement et l'horodatage partent ensemble.
    await db
      .update(users)
      .set({ derniereConnexion: new Date(), ...(user.googleId ? {} : { googleId }) })
      .where(eq(users.id, user.id));
  }

  const deviceName = deviceNameFromUserAgent(request.headers.get("user-agent"));
  const [device] = await db
    .insert(devices)
    .values({ storeId: user.storeId, userId: user.id, nom: deviceName, userAgent: request.headers.get("user-agent") })
    .returning();

  const token = await createSessionToken({
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    deviceId: device.id,
    email: user.email,
    nom: user.nom,
  });

  const res = NextResponse.redirect(new URL("/dashboard", appUrl));
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  await setSessionCookie(token);
  return res;
}
