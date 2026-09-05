// Consommation d'un lien de vérification d'adresse e-mail — inscription ou changement d'adresse
// (voir src/lib/auth/email-verification-token.ts pour le détail du mécanisme).
//
// Volontairement en POST, jamais en GET : plusieurs clients de messagerie et filtres de sécurité
// « visitent » automatiquement les liens reçus pour les analyser avant que le destinataire ne les
// ouvre. Si la confirmation se déclenchait au chargement de la page, ces visites automatiques
// consommeraient le jeton — à usage unique — avant même que le commerçant ne clique. La page
// /verifier-email affiche donc un bouton qui déclenche cet appel, jamais un lien direct vers ici.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  consommerJetonVerification,
  messageJetonVerificationInvalide,
  purgerJetonsVerification,
  verifierJetonVerification,
} from "@/lib/auth/email-verification-token";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({ jeton: z.string().trim().min(20, "Lien invalide.") });

// Le jeton est imprévisible : cette limite ne protège pas le jeton lui-même, elle évite qu'un
// script n'occupe la base à tester des liens au hasard — même raisonnement que /api/auth/reinitialiser.
const LIMITE = { limite: 20, fenetreMs: 15 * 60_000, blocageMs: 30 * 60_000 };

export async function POST(request: Request) {
  const parIp = await rateLimit(`verif-email:ip:${clientIp(request)}`, LIMITE);
  if (!parIp.ok) {
    return tooManyRequests(parIp.retryAfter, "Trop de tentatives. Réessayez dans quelques minutes.");
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const v = await verifierJetonVerification(parsed.data.jeton);
  if (!v.ok) return NextResponse.json({ error: messageJetonVerificationInvalide(v.raison) }, { status: 400 });

  // Consommé avant toute écriture : deux requêtes simultanées sur le même lien (double clic, lien
  // préchargé) ne peuvent donc pas appliquer le changement deux fois, la base tranche.
  if (!(await consommerJetonVerification(v.jeton.tokenId))) {
    return NextResponse.json({ error: messageJetonVerificationInvalide("UTILISE") }, { status: 400 });
  }

  if (v.jeton.type === "INSCRIPTION") {
    // La condition sur `email` fait partie de l'UPDATE : si l'adresse du compte a changé depuis
    // l'envoi de ce lien (un changement d'adresse a entre-temps abouti), ce vieux lien ne doit
    // jamais marquer comme vérifiée une adresse qui n'est plus la sienne.
    const [ligne] = await db
      .update(users)
      .set({ emailVerifieLe: new Date() })
      .where(and(eq(users.id, v.jeton.userId), eq(users.email, v.jeton.email)))
      .returning({ id: users.id });

    if (!ligne) {
      return NextResponse.json(
        { error: "Cette adresse a changé depuis l'envoi du lien. Redemandez une vérification." },
        { status: 400 }
      );
    }

    if (Math.random() < 0.05) await purgerJetonsVerification();
    return NextResponse.json({ ok: true, type: "INSCRIPTION" });
  }

  // CHANGEMENT_EMAIL : bascule nouvelEmail -> email. La condition `nouvel_email = ...` protège
  // contre un lien devenu obsolète (une demande plus récente a changé la cible entre-temps).
  //
  // L'adresse peut avoir été prise par un autre compte entre la demande et cette confirmation
  // (`email` est unique) : c'est une contrainte Postgres, pas une vérification faite ici — une
  // lecture préalable laisserait une fenêtre de course entre la lecture et l'écriture. On la laisse
  // donc échouer et on traduit l'erreur en message clair, plutôt que de la prévenir par une lecture
  // qui ne garantirait rien.
  try {
    const [ligne] = await db
      .update(users)
      .set({ email: v.jeton.email, nouvelEmail: null, emailVerifieLe: new Date() })
      .where(and(eq(users.id, v.jeton.userId), eq(users.nouvelEmail, v.jeton.email)))
      .returning({ id: users.id });

    if (!ligne) {
      return NextResponse.json(
        {
          error:
            "Cette demande de changement d'adresse n'est plus valable. Recommencez depuis Paramètres → Mon compte.",
        },
        { status: 400 }
      );
    }

    if (Math.random() < 0.05) await purgerJetonsVerification();
    return NextResponse.json({ ok: true, type: "CHANGEMENT_EMAIL", email: v.jeton.email });
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json(
        {
          error:
            "Cette adresse est déjà utilisée par un autre compte. Retournez dans Paramètres → Mon compte pour en choisir une autre.",
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
