import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { restaurationExpiree } from "@/components/parametres/utilisateurs/permissions-logic";

// POST /api/parametres/utilisateurs/[id]/restaurer — annule une suppression décidée par le patron,
// tant que la fenêtre de 48h (restaurationExpireLe) n'est pas dépassée.
//
// N'existe QUE pour les suppressions déclenchées par le patron sur le compte d'un employé : une
// auto-suppression (/api/parametres/compte) anonymise et laisse `restaurationExpireLe` à `null`,
// elle n'est donc jamais restaurable — ce chemin le rejette explicitement plutôt que de restaurer un
// compte dont le nom et l'e-mail ont déjà été effacés.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "parametres.utilisateurs"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (!target.desactiveLe) {
    return NextResponse.json({ error: "Ce compte n'est pas supprimé." }, { status: 400 });
  }
  if (!target.restaurationExpireLe) {
    return NextResponse.json(
      { error: "Cette suppression n'est pas restaurable : elle a été effectuée par le titulaire du compte lui-même." },
      { status: 400 }
    );
  }
  if (restaurationExpiree(target.restaurationExpireLe)) {
    return NextResponse.json(
      { error: "Le délai de restauration de 48 h est dépassé." },
      { status: 400 }
    );
  }

  const [restaure] = await db
    .update(users)
    .set({
      desactiveLe: null,
      desactiveParId: null,
      restaurationExpireLe: null,
      restaureLe: new Date(),
      restaureParId: session.userId,
    })
    .where(and(eq(users.id, id), eq(users.storeId, session.storeId)))
    .returning();

  return NextResponse.json({
    ok: true,
    user: {
      id: restaure.id,
      nom: restaure.nom,
      email: restaure.email,
      telephone: restaure.telephone,
      role: restaure.role,
      derniereConnexion: restaure.derniereConnexion ? restaure.derniereConnexion.toISOString() : null,
      creeLe: restaure.creeLe.toISOString(),
      aMotDePasse: Boolean(restaure.motDePasseHash),
      googleId: Boolean(restaure.googleId),
    },
  });
}
