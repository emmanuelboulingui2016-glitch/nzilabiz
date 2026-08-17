// Superadmin — annuaire transverse des utilisateurs de la plateforme.
//
// Lecture seule : la gestion fine d'un employé (rôle, mot de passe temporaire) reste du ressort du
// Patron de sa boutique, dans Paramètres > Utilisateurs. L'administration de la plateforme sert à
// diagnostiquer (« qui s'est connecté récemment ? », « ce compte est-il désactivé ? »), pas à
// prendre la main sur les équipes de nos clients.

import { NextResponse } from "next/server";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, users } from "@/db/schema";
import { getSuperAdminSession, isSuperAdminEmail } from "@/lib/auth/superadmin";

export async function GET(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;

  const lignes = await db
    .select({
      id: users.id,
      nom: users.nom,
      email: users.email,
      role: users.role,
      creeLe: users.creeLe,
      derniereConnexion: users.derniereConnexion,
      desactiveLe: users.desactiveLe,
      googleId: users.googleId,
      storeId: stores.id,
      storeNom: stores.nom,
      storePlan: stores.plan,
    })
    .from(users)
    .innerJoin(stores, eq(stores.id, users.storeId))
    .where(q ? or(ilike(users.nom, like), ilike(users.email, like), ilike(stores.nom, like)) : undefined)
    .orderBy(desc(sql`coalesce(${users.derniereConnexion}, ${users.creeLe})`))
    .limit(200);

  return NextResponse.json({
    utilisateurs: lignes.map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      role: u.role,
      superAdmin: isSuperAdminEmail(u.email),
      connexionGoogle: Boolean(u.googleId),
      desactive: Boolean(u.desactiveLe),
      creeLe: u.creeLe.toISOString(),
      derniereConnexion: u.derniereConnexion?.toISOString() ?? null,
      boutique: { id: u.storeId, nom: u.storeNom, plan: u.storePlan },
    })),
  });
}
