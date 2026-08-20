// Enregistrement du nouveau mot de passe, à partir du lien reçu par e-mail.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users, devices } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import {
  consommerJeton,
  deconnecterTousLesAppareils,
  messageJetonInvalide,
  purgerJetons,
  verifierJeton,
} from "@/lib/auth/reset-token";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { deviceNameFromUserAgent } from "@/lib/device-name";
import { envoyerEmail } from "@/lib/email/envoyer";
import { emailMotDePasseChange } from "@/lib/email/modeles";
import { getPlatformSettings } from "@/lib/platform-settings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  jeton: z.string().trim().min(20, "Lien invalide."),
  password: z.string().min(6, "6 caractères minimum"),
});

// Le jeton est imprévisible : il n'y a rien à deviner. Cette limite ne protège pas le jeton, elle
// évite qu'un script n'occupe la base à tester des liens au hasard.
const LIMITE = { limite: 15, fenetreMs: 15 * 60_000, blocageMs: 30 * 60_000 };

export async function POST(request: Request) {
  const parIp = await rateLimit(`reinit:ip:${clientIp(request)}`, LIMITE);
  if (!parIp.ok) {
    return tooManyRequests(parIp.retryAfter, "Trop de tentatives. Réessayez dans quelques minutes.");
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { jeton, password } = parsed.data;

  const v = await verifierJeton(jeton);
  if (!v.ok) return NextResponse.json({ error: messageJetonInvalide(v.raison) }, { status: 400 });

  // Le jeton est consommé AVANT l'enregistrement, et la base garantit qu'un seul appel y parvient.
  // Deux requêtes simultanées portant le même lien — un double clic, un lien préchargé par le
  // client de messagerie — ne peuvent donc pas définir deux mots de passe différents.
  if (!(await consommerJeton(v.jeton.tokenId))) {
    return NextResponse.json({ error: messageJetonInvalide("UTILISE") }, { status: 400 });
  }

  await db
    .update(users)
    .set({ motDePasseHash: await hashPassword(password), derniereConnexion: new Date() })
    .where(eq(users.id, v.jeton.userId));

  // Toutes les sessions ouvertes tombent. C'est le sens même d'une réinitialisation : si le compte
  // avait été pris, celui qui l'occupait est mis dehors à cet instant.
  await deconnecterTousLesAppareils(v.jeton.userId);

  const reglages = await getPlatformSettings();

  // Avis de changement. Si quelqu'un s'est emparé de la boîte mail, ce message est le seul signal
  // que reçoit le titulaire du compte — il part donc même quand tout s'est bien passé.
  await envoyerEmail({
    a: v.jeton.email,
    ...emailMotDePasseChange({
      nom: v.jeton.nom,
      nomApplication: reglages.nomApplication,
      contact: reglages.supportEmail ?? reglages.supportTelephone ?? null,
    }),
  });

  const compte = await db.query.users.findFirst({ where: eq(users.id, v.jeton.userId) });
  if (!compte) return NextResponse.json({ error: "Compte introuvable." }, { status: 400 });

  // Le nouvel appareil est créé après la révocation générale, sinon il tomberait avec les autres.
  const [device] = await db
    .insert(devices)
    .values({
      storeId: compte.storeId,
      userId: compte.id,
      nom: deviceNameFromUserAgent(request.headers.get("user-agent")),
      userAgent: request.headers.get("user-agent"),
    })
    .returning();

  const token = await createSessionToken({
    userId: compte.id,
    storeId: compte.storeId,
    role: compte.role,
    deviceId: device.id,
    email: compte.email,
    nom: compte.nom,
  });
  await setSessionCookie(token);

  if (Math.random() < 0.05) await purgerJetons();

  return NextResponse.json({ ok: true });
}
