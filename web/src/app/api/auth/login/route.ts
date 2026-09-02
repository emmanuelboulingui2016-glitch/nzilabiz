import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, devices } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";
import { deviceNameFromUserAgent } from "@/lib/device-name";
import { estAdresseEmail, normaliserTelephone } from "@/lib/telephone";
import { clientIp, rateLimit, resetRateLimit, tooManyRequests } from "@/lib/rate-limit";

// Deux compteurs complémentaires : par adresse IP (empêche un attaquant de balayer beaucoup de
// comptes depuis une machine) et par identifiant (empêche de cibler un compte précis depuis
// plusieurs adresses). Le second est volontairement plus permissif : un commerçant qui se trompe
// de mot de passe ne doit pas être bloqué pour la journée.
const LIMITE_IP = { limite: 10, fenetreMs: 5 * 60_000, blocageMs: 15 * 60_000 };
const LIMITE_IDENTIFIANT = { limite: 5, fenetreMs: 10 * 60_000, blocageMs: 10 * 60_000 };

export async function POST(request: Request) {
  const ip = clientIp(request);
  const parIp = await rateLimit(`login:ip:${ip}`, LIMITE_IP);
  if (!parIp.ok) {
    return tooManyRequests(
      parIp.retryAfter,
      `Trop de tentatives de connexion. Réessayez dans ${Math.ceil(parIp.retryAfter / 60)} minute(s).`
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { identifiant, password } = parsed.data;

  // Le patron entre son adresse, ses employés leur numéro. Le « @ » suffit à trancher : aucun
  // numéro n'en contient, aucune adresse n'en est dépourvue.
  //
  // Le numéro est normalisé avant toute comparaison — chiffres seuls, indicatif compris. Sans
  // cela, « 07 00 00 00 » et « +241 07 00 00 00 » désigneraient deux comptes différents pour
  // PostgreSQL alors que le vendeur croit taper le sien. C'est le piège que la casse des adresses
  // avait déjà tendu à ce projet (voir `src/lib/validation/auth.ts`).
  const parEmail = estAdresseEmail(identifiant);
  const cle = parEmail ? identifiant.toLowerCase() : normaliserTelephone(identifiant);

  // Un identifiant qu'on ne sait pas normaliser ne peut désigner aucun compte. On répond comme
  // pour un compte inconnu, sans dire que la forme était invalide : cette nuance renseignerait un
  // attaquant sur ce que la base contient.
  const REFUS = NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  if (!cle) return REFUS;

  const cleLimite = `login:id:${cle}`;
  const parCompte = await rateLimit(cleLimite, LIMITE_IDENTIFIANT);
  if (!parCompte.ok) {
    return tooManyRequests(
      parCompte.retryAfter,
      `Trop de tentatives sur ce compte. Réessayez dans ${Math.ceil(parCompte.retryAfter / 60)} minute(s).`
    );
  }

  const user = await db.query.users.findFirst({
    where: parEmail ? eq(users.email, cle) : eq(users.telephone, cle),
  });
  if (!user || !user.motDePasseHash || !(await verifyPassword(password, user.motDePasseHash))) {
    return REFUS;
  }

  // Compte supprimé par son titulaire : la ligne subsiste pour l'historique des ventes, mais elle
  // ne doit plus permettre de se connecter. Même message que ci-dessus, pour ne pas révéler
  // l'existence du compte.
  if (user.desactiveLe) {
    return REFUS;
  }

  await resetRateLimit(cleLimite);

  await db.update(users).set({ derniereConnexion: new Date() }).where(eq(users.id, user.id));

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
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
