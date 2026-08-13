import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { countPatrons } from "@/components/parametres/utilisateurs/queries";

const roleSchema = z.object({ role: z.enum(["PATRON", "GERANT", "VENDEUR"]) });

// PUT /api/parametres/utilisateurs/[id] — changer le rôle d'un membre de la boutique.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (target.role === "PATRON" && parsed.data.role !== "PATRON") {
    const remaining = await countPatrons(session.storeId, target.id);
    if (remaining === 0) {
      return NextResponse.json(
        { error: "Impossible de rétrograder le dernier Patron de la boutique." },
        { status: 400 }
      );
    }
  }

  const [updated] = await db.update(users).set({ role: parsed.data.role }).where(eq(users.id, id)).returning();

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      nom: updated.nom,
      email: updated.email,
      role: updated.role,
      derniereConnexion: updated.derniereConnexion ? updated.derniereConnexion.toISOString() : null,
      creeLe: updated.creeLe.toISOString(),
      aMotDePasse: Boolean(updated.motDePasseHash),
      googleId: Boolean(updated.googleId),
    },
  });
}

// DELETE /api/parametres/utilisateurs/[id] — retirer un membre de la boutique.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (target.id === session.userId) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous retirer vous-même." }, { status: 400 });
  }

  if (target.role === "PATRON") {
    const remaining = await countPatrons(session.storeId, target.id);
    if (remaining === 0) {
      return NextResponse.json(
        { error: "Impossible de retirer le dernier Patron de la boutique." },
        { status: 400 }
      );
    }
  }

  try {
    await db.delete(users).where(eq(users.id, id));
  } catch {
    // Contrainte de clé étrangère : l'utilisateur a des ventes/données associées (pas de
    // suppression en cascade prévue dans schema.ts pour ces tables). On ne fait pas de suppression
    // en douce et on l'explique clairement plutôt que de renvoyer une erreur 500 opaque.
    return NextResponse.json(
      {
        error:
          "Impossible de supprimer cet utilisateur : il a des données associées (ventes, dépenses...). Changez plutôt son rôle, ou contactez le support pour une suppression assistée.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
