// Superadmin — liste de toutes les boutiques de la plateforme, avec leur activité.

import { NextResponse } from "next/server";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isNaN(x) ? 0 : x;
}

export async function GET(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const plan = params.get("plan")?.trim();

  const conditions = [];
  if (q) {
    const like = `%${q}%`;
    conditions.push(or(ilike(stores.nom, like), ilike(stores.ville, like), ilike(stores.quartier, like)));
  }
  if (plan && plan !== "TOUS") {
    conditions.push(eq(stores.plan, plan as "ESSAI" | "ESSENTIEL" | "PREMIUM" | "ENTREPRISE"));
  }

  // Les compteurs sont calculés en sous-requêtes corrélées : une seule requête, et pas de
  // duplication de lignes comme le produirait une jointure sur deux tables « many ».
  //
  // Tout est écrit en SQL littéral, y compris la colonne de corrélation. Interpoler `stores.id`
  // dans le template produit `"id"` sans nom de table : à l'intérieur de la sous-requête, Postgres
  // résolvait alors cette référence sur `users`/`sales` (qui ont aussi une colonne `id`), la
  // condition n'était jamais vraie et tous les compteurs remontaient à zéro — sans la moindre
  // erreur SQL.
  const lignes = await db
    .select({
      id: stores.id,
      nom: stores.nom,
      ville: stores.ville,
      quartier: stores.quartier,
      typeCommerce: stores.typeCommerce,
      plan: stores.plan,
      programmeTest: stores.programmeTest,
      devise: stores.devise,
      creeLe: stores.creeLe,
      essaiExpireLe: stores.essaiExpireLe,
      abonnementExpireLe: stores.abonnementExpireLe,
      nbUtilisateurs: sql<number>`(select count(*)::int from users u where u.store_id = stores.id)`,
      nbVentes: sql<number>`(select count(*)::int from sales v where v.store_id = stores.id and v.statut = 'VALIDEE')`,
      volume: sql<string>`(select coalesce(sum(v.total), 0) from sales v where v.store_id = stores.id and v.statut = 'VALIDEE')`,
      derniereVente: sql<Date | null>`(select max(v.date_heure) from sales v where v.store_id = stores.id)`,
      derniereConnexion: sql<Date | null>`(select max(u.derniere_connexion) from users u where u.store_id = stores.id)`,
    })
    .from(stores)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${stores.creeLe} desc`)
    .limit(200);

  return NextResponse.json({
    boutiques: lignes.map((b) => ({
      id: b.id,
      nom: b.nom,
      ville: b.ville,
      quartier: b.quartier,
      typeCommerce: b.typeCommerce,
      plan: b.plan,
      programmeTest: b.programmeTest,
      devise: b.devise,
      creeLe: b.creeLe.toISOString(),
      essaiExpireLe: b.essaiExpireLe?.toISOString() ?? null,
      abonnementExpireLe: b.abonnementExpireLe?.toISOString() ?? null,
      nbUtilisateurs: b.nbUtilisateurs,
      nbVentes: b.nbVentes,
      volume: n(b.volume),
      derniereVente: b.derniereVente ? new Date(b.derniereVente).toISOString() : null,
      derniereConnexion: b.derniereConnexion ? new Date(b.derniereConnexion).toISOString() : null,
    })),
  });
}
