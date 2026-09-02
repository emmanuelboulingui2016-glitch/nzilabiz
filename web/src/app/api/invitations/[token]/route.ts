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
import { bloquerSiPlafondComptes, etatBoutique } from "@/lib/abonnement";
import { normaliserTelephone, formaterTelephone } from "@/lib/telephone";

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
      telephonePrevu: res.invitation.telephonePrevu,
      expireLe: res.invitation.expireLe.toISOString(),
      boutique: boutique?.nom ?? "",
    },
  });
}

const schema = z.object({
  nom: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  telephone: z.string().trim().min(1, "Votre numéro de téléphone est requis.").max(30),
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

  // Le numéro est normalisé avant toute comparaison : « 07 00 00 00 » et « +241 07 00 00 00 »
  // désignent le même abonné, et l'employé ne doit pas être refusé parce qu'il a écrit son numéro
  // autrement que son patron (voir `src/lib/telephone.ts`).
  const boutiqueInvitante = await db.query.stores.findFirst({
    where: eq(stores.id, res.invitation.storeId),
    columns: { indicatif: true },
  });
  const telephone = normaliserTelephone(parsed.data.telephone, boutiqueInvitante?.indicatif);
  if (!telephone) {
    return NextResponse.json({ error: "Ce numéro de téléphone n'est pas valide." }, { status: 400 });
  }

  // Si l'invitation visait un numéro précis, on s'y tient : sinon un lien transmis à un tiers
  // permettrait d'entrer dans la boutique sous une autre identité.
  if (res.invitation.telephonePrevu && res.invitation.telephonePrevu !== telephone) {
    return NextResponse.json(
      { error: `Cette invitation est réservée au ${formaterTelephone(res.invitation.telephonePrevu, boutiqueInvitante?.indicatif)}.` },
      { status: 400 }
    );
  }

  // Le garde-fou « cette adresse est celle d'un administrateur de plateforme » disparaît avec
  // l'adresse : une invitation ne crée plus qu'un compte identifié par un numéro, et la liste des
  // administrateurs est faite d'adresses. Rien à contourner ici.

  const existant = await db.query.users.findFirst({ where: eq(users.telephone, telephone) });
  if (existant) {
    return NextResponse.json({ error: "Un compte existe déjà avec ce numéro." }, { status: 409 });
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
      telephone,
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
