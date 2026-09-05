// Renvoi de l'e-mail de vérification d'inscription — le premier peut se perdre, arriver en
// indésirables, ou l'adresse avoir été mal tapée. Identité prise depuis la session, jamais du
// corps de la requête (§4.2) : sans ça, cette route deviendrait un moyen d'envoyer un e-mail à
// n'importe quelle adresse depuis le domaine de l'application.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { VALIDITE_MINUTES, creerJetonVerification } from "@/lib/auth/email-verification-token";
import { emailConfigure, envoyerEmail } from "@/lib/email/envoyer";
import { emailVerificationInscription } from "@/lib/email/modeles";
import { getPlatformSettings } from "@/lib/platform-settings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Trois renvois par heure suffisent à corriger une adresse mal tapée ou un message perdu dans les
// indésirables, sans faire de cette route un moyen de spammer une boîte mail depuis notre domaine.
const LIMITE = { limite: 3, fenetreMs: 60 * 60_000, blocageMs: 60 * 60_000 };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!emailConfigure()) {
    return NextResponse.json(
      { error: "L'envoi d'e-mails n'est pas encore disponible. Réessayez plus tard." },
      { status: 503 }
    );
  }

  const limite = await rateLimit(`verif-email:renvoyer:${session.userId}:${clientIp(request)}`, LIMITE);
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de demandes. Réessayez dans un moment.");
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (!user.email) {
    return NextResponse.json({ error: "Ce compte n'a pas d'adresse e-mail à vérifier." }, { status: 400 });
  }
  if (user.emailVerifieLe) {
    return NextResponse.json({ ok: true, dejaVerifiee: true });
  }

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

  if (!envoye) {
    return NextResponse.json({ error: "L'envoi a échoué. Réessayez dans un moment." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
