// Superadmin — annuaire des titulaires de boutique (rôle PATRON), toutes boutiques confondues.
//
// Cette route s'appelait à l'origine un « annuaire transverse des utilisateurs » et listait
// nommément tout employé de toute boutique (gérants et vendeurs compris). Elle a été restreinte
// aux titulaires : le patron d'une boutique est l'interlocuteur commercial de la plateforme —
// c'est lui qu'on facture et qu'on rappelle en cas de support — mais ses gérants et vendeurs sont
// les employés d'un client, la plateforme n'a pas à les connaître nommément. Le rôle n'est jamais
// lu pour les comptes GERANT/VENDEUR : la coupure se fait dans la requête, pas seulement à
// l'affichage.
//
// Lecture seule : la gestion fine d'un employé (rôle, mot de passe temporaire) reste du ressort du
// Patron de sa boutique, dans Paramètres > Utilisateurs.

import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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
      telephone: users.telephone,
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
    .where(
      and(
        eq(users.role, "PATRON"),
        q ? or(ilike(users.nom, like), ilike(users.email, like), ilike(stores.nom, like)) : undefined
      )
    )
    .orderBy(desc(sql`coalesce(${users.derniereConnexion}, ${users.creeLe})`))
    .limit(200);

  return NextResponse.json({
    titulaires: lignes.map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      telephone: u.telephone,
      superAdmin: isSuperAdminEmail(u.email),
      connexionGoogle: Boolean(u.googleId),
      desactive: Boolean(u.desactiveLe),
      creeLe: u.creeLe.toISOString(),
      derniereConnexion: u.derniereConnexion?.toISOString() ?? null,
      boutique: { id: u.storeId, nom: u.storeNom, plan: u.storePlan },
    })),
  });
}
