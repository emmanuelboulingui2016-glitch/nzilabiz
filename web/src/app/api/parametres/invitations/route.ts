// Invitations d'employés — le patron génère un lien à durée limitée, affiché en QR code.
// L'employé le scanne avec son téléphone, choisit son mot de passe, et rejoint la boutique.
//
// Remplace avantageusement le mot de passe temporaire dicté de vive voix : rien à retenir, rien à
// écrire sur un papier, et le lien expire tout seul.

import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db/client";
import { invitations, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree, bloquerSiPlafondComptes, etatBoutiqueCourante } from "@/lib/abonnement";

const DUREE_JOURS = 7;

const schema = z.object({
  role: z.enum(["GERANT", "VENDEUR"]),
  nomPrevu: z.string().trim().max(120).nullable().optional(),
  emailPrevu: z.string().trim().email("E-mail invalide.").toLowerCase().nullable().optional().or(z.literal("")),
  dureeJours: z.number().int().min(1).max(30).optional(),
});

function etat(inv: typeof invitations.$inferSelect): "UTILISEE" | "REVOQUEE" | "EXPIREE" | "ACTIVE" {
  if (inv.utiliseLe) return "UTILISEE";
  if (inv.revoqueLe) return "REVOQUEE";
  if (inv.expireLe < new Date()) return "EXPIREE";
  return "ACTIVE";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Plafond de comptes de la formule. Vérifié ici et à l'acceptation de l'invitation : ce sont
  // les deux seuls endroits où une ligne `users` naît.
  const etatFormule = await etatBoutiqueCourante();
  const plafond = await bloquerSiPlafondComptes(session.storeId, etatFormule?.plan ?? "ESSAI");
  if (plafond) return plafond;

  const lignes = await db
    .select()
    .from(invitations)
    .where(eq(invitations.storeId, session.storeId))
    .orderBy(desc(invitations.creeLe))
    .limit(50);

  return NextResponse.json({
    invitations: lignes.map((i) => ({
      id: i.id,
      token: i.token,
      role: i.role,
      nomPrevu: i.nomPrevu,
      emailPrevu: i.emailPrevu,
      etat: etat(i),
      expireLe: i.expireLe.toISOString(),
      utiliseLe: i.utiliseLe?.toISOString() ?? null,
      creeLe: i.creeLe.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const email = parsed.data.emailPrevu?.trim() || null;
  if (email) {
    const existant = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existant) {
      return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
    }
  }

  const expireLe = new Date();
  expireLe.setDate(expireLe.getDate() + (parsed.data.dureeJours ?? DUREE_JOURS));

  // Deux identifiants concaténés : le jeton doit être impossible à deviner, il vaut un mot de
  // passe tant qu'il n'a pas été utilisé.
  const token = `${createId()}${createId()}`;

  const [invitation] = await db
    .insert(invitations)
    .values({
      storeId: session.storeId,
      token,
      role: parsed.data.role,
      nomPrevu: parsed.data.nomPrevu?.trim() || null,
      emailPrevu: email,
      creeParId: session.userId,
      expireLe,
    })
    .returning();

  return NextResponse.json(
    {
      invitation: {
        id: invitation.id,
        token: invitation.token,
        role: invitation.role,
        nomPrevu: invitation.nomPrevu,
        emailPrevu: invitation.emailPrevu,
        etat: "ACTIVE",
        expireLe: invitation.expireLe.toISOString(),
        creeLe: invitation.creeLe.toISOString(),
      },
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Invitation non précisée" }, { status: 400 });

  const invitation = await db.query.invitations.findFirst({
    where: and(eq(invitations.id, id), eq(invitations.storeId, session.storeId)),
  });
  if (!invitation) return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
  if (invitation.utiliseLe) {
    return NextResponse.json({ error: "Cette invitation a déjà été utilisée." }, { status: 400 });
  }

  await db.update(invitations).set({ revoqueLe: new Date() }).where(eq(invitations.id, id));
  return NextResponse.json({ ok: true });
}
