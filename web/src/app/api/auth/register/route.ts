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
  const { nom, email, password, storeName } = parsed.data;

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

  const motDePasseHash = await hashPassword(password);
  const essaiExpireLe = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 jours d'essai gratuit (§16)

  const [store] = await db
    .insert(stores)
    .values({ nom: storeName, plan: "ESSAI", essaiExpireLe })
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

  return NextResponse.json({ ok: true, storeId: store.id });
}
