import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { countPatrons } from "@/components/parametres/utilisateurs/queries";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { normaliserTelephone } from "@/lib/telephone";
import { stores } from "@/db/schema";

const majSchema = z
  .object({
    nom: z.string().trim().min(1, "Le nom est requis.").max(120).optional(),
    role: z.enum(["PATRON", "GERANT", "VENDEUR"]).optional(),
    telephone: z.string().trim().max(30).optional().nullable(),
  })
  .refine((v) => v.nom !== undefined || v.role !== undefined || v.telephone !== undefined, {
    message: "Aucune modification fournie.",
  });

// PUT /api/parametres/utilisateurs/[id] — corriger le nom, le rôle ou le numéro d'un membre.
//
// Le numéro fait partie de ce qu'on peut corriger, et ce n'est pas un détail : un vendeur change
// de puce ou de téléphone plus souvent qu'on ne croit. Sans cette route, la seule issue serait de
// supprimer son compte et d'en créer un autre — en perdant le rattachement de toutes ses ventes
// passées, qui portent son identifiant.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = majSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // Le filtre porte aussi sur la boutique : sans lui, l'identifiant d'un employé d'un autre
  // commerçant suffirait à modifier son compte.
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (parsed.data.role && target.role === "PATRON" && parsed.data.role !== "PATRON") {
    const remaining = await countPatrons(session.storeId, target.id);
    if (remaining === 0) {
      return NextResponse.json(
        { error: "Impossible de rétrograder le dernier Patron de la boutique." },
        { status: 400 }
      );
    }
  }

  const maj: { nom?: string; role?: "PATRON" | "GERANT" | "VENDEUR"; telephone?: string | null } = {};
  if (parsed.data.nom !== undefined) maj.nom = parsed.data.nom;
  if (parsed.data.role !== undefined) maj.role = parsed.data.role;

  if (parsed.data.telephone !== undefined) {
    const brut = parsed.data.telephone?.trim() ?? "";
    if (!brut) {
      // On ne retire un numéro que si le compte garde une adresse pour se connecter. Sinon on
      // enfermerait quelqu'un dehors d'un simple champ vidé par inadvertance.
      if (!target.email) {
        return NextResponse.json(
          { error: "Ce compte se connecte avec son numéro : il ne peut pas être retiré." },
          { status: 400 }
        );
      }
      maj.telephone = null;
    } else {
      const boutique = await db.query.stores.findFirst({
        where: eq(stores.id, session.storeId),
        columns: { indicatif: true },
      });
      const normalise = normaliserTelephone(brut, boutique?.indicatif);
      if (!normalise) {
        return NextResponse.json({ error: "Ce numéro de téléphone n'est pas valide." }, { status: 400 });
      }
      const occupe = await db.query.users.findFirst({ where: eq(users.telephone, normalise) });
      if (occupe && occupe.id !== target.id) {
        return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre compte." }, { status: 409 });
      }
      maj.telephone = normalise;
    }
  }

  // Le SELECT préalable a déjà vérifié l'appartenance à la boutique, mais on la refiltre ici :
  // défense en profondeur si ce SELECT venait à disparaître dans une future refactorisation.
  const [updated] = await db
    .update(users)
    .set(maj)
    .where(and(eq(users.id, id), eq(users.storeId, session.storeId)))
    .returning();

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      nom: updated.nom,
      email: updated.email,
      telephone: updated.telephone,
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

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
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
    // Le SELECT préalable a déjà vérifié l'appartenance à la boutique, mais on la refiltre ici :
    // défense en profondeur si ce SELECT venait à disparaître dans une future refactorisation.
    await db.delete(users).where(and(eq(users.id, id), eq(users.storeId, session.storeId)));
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
