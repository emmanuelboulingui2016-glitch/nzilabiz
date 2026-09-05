import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { stores, users, devices, notificationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/auth";
import { deviceNameFromUserAgent } from "@/lib/device-name";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { verifierCodeTest, messageRefus } from "@/lib/test-access";
import { VALIDITE_MINUTES, creerJetonVerification } from "@/lib/auth/email-verification-token";
import { emailConfigure, envoyerEmail } from "@/lib/email/envoyer";
import { emailVerificationInscription } from "@/lib/email/modeles";
import { getPlatformSettings } from "@/lib/platform-settings";

// L'inscription crée une boutique complète : sans limite, un script pourrait en créer des
// milliers. 5 par adresse et par heure laisse largement de quoi corriger une erreur de saisie.
const LIMITE_INSCRIPTION = { limite: 5, fenetreMs: 60 * 60_000, blocageMs: 60 * 60_000 };

export async function POST(request: Request) {
  const limite = await rateLimit(`register:ip:${clientIp(request)}`, LIMITE_INSCRIPTION);
  if (!limite.ok) {
    return tooManyRequests(
      limite.retryAfter,
      "Trop de créations de compte depuis cet appareil. Réessayez dans une heure."
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nom, email, password, storeName, codeTest } = parsed.data;

  // Une adresse inscrite dans SUPERADMIN_EMAILS ne doit jamais pouvoir être revendiquée par
  // l'inscription publique : rien ne vérifie qu'un candidat possède réellement l'adresse qu'il
  // saisit, et le premier arrivé hériterait de l'administration de toute la plateforme. Les comptes
  // superadmin se créent délibérément, jamais par ce formulaire. Message volontairement neutre :
  // il n'apprend pas au visiteur quelles adresses sont privilégiées.
  if (isSuperAdminEmail(email)) {
    return NextResponse.json(
      { error: "Cette adresse ne peut pas être utilisée pour créer une boutique." },
      { status: 403 }
    );
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
  }

  // Programme de test : le code ouvre l'accès complet jusqu'à la fin de la période annoncée, au
  // lieu des 15 jours d'essai standard. Un code fourni mais invalide arrête l'inscription plutôt
  // que de créer silencieusement une boutique en essai court : le testeur croirait être entré
  // dans le programme et découvrirait l'inverse au pire moment.
  let essaiExpireLe = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 jours d'essai (§16)
  let programmeTest = false;

  if (codeTest) {
    const acces = await verifierCodeTest(codeTest);
    if (!acces.valide) {
      return NextResponse.json({ error: messageRefus(acces.raison) }, { status: 403 });
    }
    essaiExpireLe = acces.expireLe;
    programmeTest = true;
  }

  const motDePasseHash = await hashPassword(password);

  const [store] = await db
    .insert(stores)
    .values({ nom: storeName, plan: "ESSAI", essaiExpireLe, programmeTest })
    .returning();

  const [user] = await db
    .insert(users)
    .values({ storeId: store.id, nom, email, motDePasseHash, role: "PATRON" })
    .returning();

  await db.insert(notificationSettings).values({ storeId: store.id });

  const deviceName = deviceNameFromUserAgent(request.headers.get("user-agent"));
  const [device] = await db
    .insert(devices)
    .values({ storeId: store.id, userId: user.id, nom: deviceName, userAgent: request.headers.get("user-agent") })
    .returning();

  const token = await createSessionToken({
    userId: user.id,
    storeId: store.id,
    role: "PATRON",
    deviceId: device.id,
    email: user.email,
    nom: user.nom,
  });
  await setSessionCookie(token);

  // E-mail de vérification — jamais bloquant (voir le commentaire sur `users.emailVerifieLe` dans
  // le schéma). Aucun identifiant d'envoi n'est garanti configuré en production : si `emailConfigure()`
  // répond `false`, ou si l'envoi échoue, l'inscription aboutit quand même. Seul un bandeau dans
  // l'application signalera ensuite l'adresse non confirmée — jamais un blocage à l'entrée.
  if (user.email && emailConfigure()) {
    const reglages = await getPlatformSettings();
    const jeton = await creerJetonVerification(user.id, "INSCRIPTION", user.email, clientIp(request));
    const base = process.env.APP_URL ?? new URL(request.url).origin;
    const envoye = await envoyerEmail({
      a: user.email,
      ...emailVerificationInscription({
        nom: user.nom,
        lien: `${base}/verifier-email/${jeton}`,
        nomApplication: reglages.nomApplication,
        valableHeures: Math.round(VALIDITE_MINUTES / 60),
      }),
    });
    if (!envoye) console.error(`inscription : e-mail de vérification pour ${user.email} non envoyé.`);
  }

  return NextResponse.json({ ok: true, storeId: store.id });
}
