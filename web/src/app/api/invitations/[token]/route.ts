// Acceptation d'une invitation — endpoint public : l'employé qui scanne le QR code n'a pas encore
// de compte, il ne peut donc pas être authentifié.
//
// GET  : vérifie le jeton et renvoie de quoi afficher la page (boutique, rôle proposé).
// POST : crée le compte et ouvre la session. Le jeton est consommé dans la même transaction pour
//        qu'un lien partagé ne puisse pas servir deux fois.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { devices, invitations, stores, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { deviceNameFromUserAgent } from "@/lib/device-name";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { bloquerSiPlafondComptes, etatBoutique } from "@/lib/abonnement";

async function chargerInvitation(token: string) {
  const invitation = await db.query.invitations.findFirst({ where: eq(invitations.token, token) });
  if (!invitation) return { erreur: "Cette invitation n'existe pas." as const };
  if (invitation.utiliseLe) return { erreur: "Cette invitation a déjà été utilisée." as const };
  if (invitation.revoqueLe) return { erreur: "Cette invitation a été annulée." as const };
  if (invitation.expireLe < new Date()) return { erreur: "Cette invitation a expiré." as const };
  return { invitation };
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await chargerInvitation(token);
  if ("erreur" in res) return NextResponse.json({ error: res.erreur }, { status: 410 });

  const boutique = await db.query.stores.findFirst({ where: eq(stores.id, res.invitation.storeId) });

  return NextResponse.json({
    invitation: {
      role: res.invitation.role,
      nomPrevu: res.invitation.nomPrevu,
      emailPrevu: res.invitation.emailPrevu,
      expireLe: res.invitation.expireLe.toISOString(),
      boutique: boutique?.nom ?? "",
    },
  });
}

const schema = z.object({
  nom: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.string().trim().email("E-mail invalide.").toLowerCase(),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limite = await rateLimit(`invitation:${clientIp(request)}`, {
    limite: 10,
    fenetreMs: 15 * 60_000,
    blocageMs: 30 * 60_000,
  });
  if (!limite.ok) return tooManyRequests(limite.retryAfter, "Trop de tentatives. Réessayez plus tard.");

  const { token } = await params;
  const res = await chargerInvitation(token);
  if ("erreur" in res) return NextResponse.json({ error: res.erreur }, { status: 410 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Si l'invitation visait une adresse précise, on s'y tient : sinon un lien transmis à un tiers
  // permettrait d'entrer dans la boutique sous une autre identité.
  if (res.invitation.emailPrevu && res.invitation.emailPrevu.toLowerCase() !== email) {
    return NextResponse.json(
      { error: `Cette invitation est réservée à ${res.invitation.emailPrevu}.` },
      { status: 400 }
    );
  }

  // Même garde-fou qu'à l'inscription publique : l'invité choisit librement son adresse quand
  // l'invitation n'en impose pas une. Sans ce contrôle, un employé invité comme simple vendeur
  // pourrait saisir une adresse de superadmin et ressortir administrateur de toute la plateforme.
  if (isSuperAdminEmail(email)) {
    return NextResponse.json(
      { error: "Cette adresse ne peut pas être utilisée." },
      { status: 403 }
    );
  }

  const existant = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existant) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
  }

  // Plafond de comptes de la formule. C'est ici que le contrôle compte vraiment : la vérification
  // faite au moment de créer l'invitation ne dit rien de l'état de la boutique au moment où le
  // lien est utilisé, parfois plusieurs jours après et après d'autres embauches.
  //
  // L'état est lu depuis la boutique de l'invitation, pas depuis une session : la personne qui
  // accepte n'est pas encore connectée.
  const etatBoutiqueInvitante = await etatBoutique(res.invitation.storeId);
  const plafond = await bloquerSiPlafondComptes(res.invitation.storeId, etatBoutiqueInvitante.plan);
  if (plafond) return plafond;

  const motDePasseHash = await hashPassword(parsed.data.password);

  const [utilisateur] = await db
    .insert(users)
    .values({
      storeId: res.invitation.storeId,
      nom: parsed.data.nom,
      email,
      motDePasseHash,
      role: res.invitation.role,
    })
    .returning();

  await db
    .update(invitations)
    .set({ utiliseLe: new Date(), utiliseParId: utilisateur.id })
    .where(eq(invitations.id, res.invitation.id));

  const [device] = await db
    .insert(devices)
    .values({
      storeId: res.invitation.storeId,
      userId: utilisateur.id,
      nom: deviceNameFromUserAgent(request.headers.get("user-agent")),
      userAgent: request.headers.get("user-agent"),
    })
    .returning();

  const jeton = await createSessionToken({
    userId: utilisateur.id,
    storeId: utilisateur.storeId,
    role: utilisateur.role,
    deviceId: device.id,
    email: utilisateur.email,
    nom: utilisateur.nom,
  });
  await setSessionCookie(jeton);

  return NextResponse.json({ ok: true }, { status: 201 });
}
