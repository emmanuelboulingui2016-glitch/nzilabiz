// Demande de réinitialisation : envoie un lien à usage unique à l'adresse du compte.
//
// La réponse est identique que l'adresse existe ou non. C'est la règle centrale de cet écran :
// s'il répondait « compte inconnu », le formulaire deviendrait un annuaire des commerçants
// inscrits, utilisable par n'importe qui pour vérifier une liste d'adresses. Le visiteur légitime
// n'y perd rien — s'il a un compte, il reçoit le message.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { creerJeton, VALIDITE_MINUTES } from "@/lib/auth/reset-token";
import { emailConfigure, envoyerEmail } from "@/lib/email/envoyer";
import { emailReinitialisation } from "@/lib/email/modeles";
import { getPlatformSettings } from "@/lib/platform-settings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email("Adresse e-mail invalide").toLowerCase() });

// Deux compteurs. Par adresse IP : empêche de balayer une liste d'adresses. Par compte visé :
// empêche d'inonder la boîte mail d'un commerçant précis depuis plusieurs origines.
const LIMITE_IP = { limite: 5, fenetreMs: 60 * 60_000, blocageMs: 60 * 60_000 };
const LIMITE_COMPTE = { limite: 3, fenetreMs: 60 * 60_000, blocageMs: 60 * 60_000 };

// Réponse unique, quoi qu'il arrive en interne.
const REPONSE = {
  ok: true,
  message:
    "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'y être envoyé. " +
    "Pensez à regarder dans les indésirables.",
};

export async function POST(request: Request) {
  if (!emailConfigure()) {
    return NextResponse.json(
      { error: "La réinitialisation par e-mail n'est pas disponible. Contactez le support." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  const parIp = await rateLimit(`oubli:ip:${ip}`, LIMITE_IP);
  if (!parIp.ok) {
    return tooManyRequests(parIp.retryAfter, "Trop de demandes depuis cet appareil. Réessayez dans une heure.");
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { email } = parsed.data;

  // Ce compteur est consulté avant de savoir si le compte existe : le franchir ne révèle donc rien
  // non plus. On renvoie la réponse habituelle plutôt qu'un 429, pour ne pas distinguer une
  // adresse très sollicitée d'une adresse inconnue.
  const parCompte = await rateLimit(`oubli:compte:${email}`, LIMITE_COMPTE);
  if (!parCompte.ok) return NextResponse.json(REPONSE);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  // Compte fermé par son titulaire : aucun envoi. Un compte supprimé ne se rouvre pas par ce
  // chemin, et son adresse a de toute façon été remplacée à la suppression.
  if (!user || user.desactiveLe) return NextResponse.json(REPONSE);

  const reglages = await getPlatformSettings();
  const jeton = await creerJeton(user.id, ip);
  const base = process.env.APP_URL ?? new URL(request.url).origin;

  const envoye = await envoyerEmail({
    a: user.email,
    ...emailReinitialisation({
      nom: user.nom,
      lien: `${base}/reinitialiser/${jeton}`,
      nomApplication: reglages.nomApplication,
      valableMinutes: VALIDITE_MINUTES,
    }),
  });

  // L'échec est journalisé mais reste invisible du visiteur : lui dire « envoi impossible » ne lui
  // apprendrait rien d'utile et confirmerait au passage l'existence du compte.
  if (!envoye) console.error(`oubli : le lien pour ${email} n'a pas pu être envoyé.`);

  return NextResponse.json(REPONSE);
}
