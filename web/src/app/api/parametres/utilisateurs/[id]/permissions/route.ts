import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { employeePermissionOverrides, users } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { can, permissionsFor, resoudrePermissions, PERMISSIONS } from "@/lib/auth/rbac";
import { administrateursDeLaBoutique, derogationsActivesDe } from "@/components/parametres/utilisateurs/queries";
import { bloquerSiExpiree } from "@/lib/abonnement";

// Dérogations individuelles à la matrice de rôle (§14) — le patron accorde ou retire un droit
// précis à un employé. Voir employeePermissionOverrides (schema.ts) et rbac.ts::resoudrePermissions
// pour la règle de résolution (matrice du rôle, puis dérogation active la plus récente).

async function etatPermissions(targetId: string, role: "PATRON" | "GERANT" | "VENDEUR") {
  const overrides = await derogationsActivesDe(targetId);
  const effectives = new Set(resoudrePermissions(role, overrides));
  const parRole = new Set(permissionsFor(role));
  const derogationParPermission = new Map(overrides.map((o) => [o.permission, o]));

  return PERMISSIONS.map((permission) => ({
    permission,
    parRole: parRole.has(permission),
    derogation: derogationParPermission.get(permission)?.action ?? null,
    effectif: effectives.has(permission),
  }));
}

// GET /api/parametres/utilisateurs/[id]/permissions — état des permissions d'un membre : ce que son
// rôle donne, ce qu'une dérogation a changé, et le résultat effectif — pour que l'écart au rôle soit
// visible d'un coup d'œil dans l'écran Utilisateurs.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(session, "parametres.utilisateurs"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId), isNull(users.desactiveLe)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  return NextResponse.json({
    role: target.role,
    permissions: await etatPermissions(target.id, target.role),
  });
}

const putSchema = z.object({
  permission: z.enum(PERMISSIONS),
  accorder: z.boolean(),
});

// PUT /api/parametres/utilisateurs/[id]/permissions — accorde ou retire un droit précis à un membre.
//
// Idempotent côté état final : le corps décrit l'état voulu (« cet employé a-t-il ce droit, oui ou
// non »), pas un enregistrement à créer. Si l'état voulu correspond déjà à ce que donne son rôle, on
// se contente de révoquer une éventuelle dérogation existante — inutile de garder une dérogation qui
// ne fait que répéter le rôle. Sinon on pose une nouvelle dérogation, après avoir révoqué l'ancienne
// sur cette même permission : aucune contrainte SQL n'empêche deux dérogations actives à la fois
// (schema.ts), c'est donc à cette route de le garantir.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "parametres.utilisateurs"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { permission, accorder } = parsed.data;

  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId), isNull(users.desactiveLe)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Garde-fou n°1 : un patron ne doit jamais pouvoir se retirer à lui-même le droit de gérer les
  // utilisateurs — même s'il reste d'autres patrons dans la boutique. C'est justement l'écran qu'il
  // est en train d'utiliser ; s'en couper l'accès au milieu de l'action serait le scénario du
  // dimanche soir où plus personne ne peut plus rien changer sans passer par le support.
  if (permission === "parametres.utilisateurs" && !accorder && target.id === session.userId) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas vous retirer vous-même le droit de gérer les utilisateurs." },
      { status: 400 }
    );
  }

  // Garde-fou n°2 : ne jamais laisser la boutique sans personne pour administrer les utilisateurs.
  if (permission === "parametres.utilisateurs" && !accorder) {
    const administrateurs = await administrateursDeLaBoutique(session.storeId);
    let comptesAvecAcces = 0;
    for (const [userId, aAcces] of administrateurs) {
      const effectifApres = userId === target.id ? accorder : aAcces;
      if (effectifApres) comptesAvecAcces++;
    }
    if (comptesAvecAcces === 0) {
      return NextResponse.json(
        { error: "Il doit rester au moins une personne pouvant administrer les utilisateurs de la boutique." },
        { status: 400 }
      );
    }
  }

  // Révoque toute dérogation active sur (utilisateur, permission) — traçable, jamais réécrite en
  // place : l'historique d'un droit doit survivre à son propre retrait (voir schema.ts).
  await db
    .update(employeePermissionOverrides)
    .set({ revoqueLe: new Date(), revoqueParId: session.userId })
    .where(
      and(
        eq(employeePermissionOverrides.userId, target.id),
        eq(employeePermissionOverrides.permission, permission),
        isNull(employeePermissionOverrides.revoqueLe)
      )
    );

  const parRoleDefaut = can(target.role, permission);
  if (accorder !== parRoleDefaut) {
    await db.insert(employeePermissionOverrides).values({
      storeId: session.storeId,
      userId: target.id,
      permission,
      action: accorder ? "ACCORDEE" : "RETIREE",
      accordeParId: session.userId,
    });
  }

  return NextResponse.json({
    role: target.role,
    permissions: await etatPermissions(target.id, target.role),
  });
}
