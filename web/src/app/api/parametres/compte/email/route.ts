// Changement de l'adresse e-mail de la boutique — un seul e-mail par boutique, celui du Patron ;
// les employés se connectent par numéro de téléphone (src/lib/telephone.ts). Voir le commentaire
// sur `users.email` / `users.nouvelEmail` dans le schéma : la nouvelle adresse est stockée à part
// et ne remplace l'actuelle qu'une fois son lien de confirmation utilisé
// (/api/auth/verifier-email). Une faute de frappe sur la nouvelle adresse ne doit jamais fermer
// l'accès au compte — c'est la seule adresse de la boutique, personne d'autre ne peut la corriger.

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { emailVerificationTokens, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { VALIDITE_MINUTES, creerJetonVerification } from "@/lib/auth/email-verification-token";
import { emailConfigure, envoyerEmail } from "@/lib/email/envoyer";
import { emailChangementDemande, emailVerificationChangement } from "@/lib/email/modeles";
import { getPlatformSettings } from "@/lib/platform-settings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { changerEmailSchema } from "@/lib/validation/compte";

// Cinq demandes par heure : largement de quoi corriger une faute de frappe, pas assez pour faire
// de cette route un moyen d'envoyer des e-mails en boucle depuis le domaine de l'application.
const LIMITE = { limite: 5, fenetreMs: 60 * 60_000, blocageMs: 60 * 60_000 };

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Un seul e-mail par boutique, celui du Patron (voir schéma users) : les comptes d'employés n'en
  // ont pas, la question ne se pose donc que pour lui.
  if (session.role !== "PATRON") {
    return NextResponse.json(
      { error: "Seul le Patron peut changer l'adresse e-mail de la boutique." },
      { status: 403 }
    );
  }

  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;

  // Aucun jeton ne serait jamais délivré à la nouvelle adresse : inutile de créer une demande qui
  // ne pourra jamais aboutir, elle laisserait juste `nouvelEmail` bloqué en attente indéfiniment.
  if (!emailConfigure()) {
    return NextResponse.json(
      {
        error:
          "Le changement d'adresse nécessite l'envoi d'un e-mail de confirmation, indisponible pour le moment. Contactez le support.",
      },
      { status: 503 }
    );
  }

  const limite = await rateLimit(`compte:email:${session.userId}:${clientIp(request)}`, LIMITE);
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de demandes. Réessayez dans un moment.");
  }

  const parsed = changerEmailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nouvelEmail } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Mot de passe actuel exigé, comme pour tout changement sensible du compte — même procédé que
  // /api/parametres/securite. Un compte créé via Google et sans mot de passe n'a rien de plus à
  // prouver que sa session déjà ouverte.
  if (user.motDePasseHash) {
    if (!parsed.data.motDePasse) {
      return NextResponse.json({ error: "Mot de passe actuel requis." }, { status: 400 });
    }
    const valide = await verifyPassword(parsed.data.motDePasse, user.motDePasseHash);
    if (!valide) return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
  }

  if (nouvelEmail === user.email) {
    return NextResponse.json({ error: "C'est déjà votre adresse actuelle." }, { status: 400 });
  }

  // Vérification immédiate, pour un retour rapide plutôt qu'un aller-retour e-mail pour rien. Elle
  // ne dispense pas de la contrainte unique de la base au moment de la bascule (voir
  // /api/auth/verifier-email) : cette adresse peut encore être prise entre-temps par un autre
  // compte, c'est cette seconde vérification qui tranche pour de bon.
  const dejaPris = await db.query.users.findFirst({ where: eq(users.email, nouvelEmail) });
  if (dejaPris) {
    return NextResponse.json({ error: "Cette adresse est déjà utilisée par un autre compte." }, { status: 409 });
  }

  await db.update(users).set({ nouvelEmail }).where(eq(users.id, user.id));

  const reglages = await getPlatformSettings();
  const ip = clientIp(request);
  const jeton = await creerJetonVerification(user.id, "CHANGEMENT_EMAIL", nouvelEmail, ip);
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  const valableHeures = Math.round(VALIDITE_MINUTES / 60);

  const envoye = await envoyerEmail({
    a: nouvelEmail,
    ...emailVerificationChangement({
      nom: user.nom,
      lien: `${base}/verifier-email/${jeton}`,
      nomApplication: reglages.nomApplication,
      valableHeures,
    }),
  });
  if (!envoye) console.error(`changement d'adresse : lien de confirmation pour ${nouvelEmail} non envoyé.`);

  // Avis à l'ANCIENNE adresse, sans lien : c'est ce qui permet à un titulaire dont le compte serait
  // compromis de s'apercevoir qu'un changement a été demandé en son nom, tant qu'il a encore accès
  // à cette boîte.
  if (user.email) {
    await envoyerEmail({
      a: user.email,
      ...emailChangementDemande({
        nom: user.nom,
        nomApplication: reglages.nomApplication,
        nouvelleAdresse: nouvelEmail,
        contact: reglages.supportEmail ?? reglages.supportTelephone ?? null,
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    message: `Un lien de confirmation a été envoyé à ${nouvelEmail}. Votre adresse actuelle reste active tant qu'il n'est pas confirmé.`,
  });
}

// Annule une demande de changement en attente — une faute de frappe repérée avant confirmation
// n'oblige pas à attendre l'expiration du lien.
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "PATRON") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await db.update(users).set({ nouvelEmail: null }).where(eq(users.id, session.userId));
  await db
    .update(emailVerificationTokens)
    .set({ utiliseLe: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.userId, session.userId),
        eq(emailVerificationTokens.type, "CHANGEMENT_EMAIL"),
        isNull(emailVerificationTokens.utiliseLe)
      )
    );

  return NextResponse.json({ ok: true });
}
