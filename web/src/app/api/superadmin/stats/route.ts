// Superadmin — vue d'ensemble de la plateforme.
//
// Toutes les agrégations sont faites en SQL : le nombre de boutiques peut grandir, la page ne doit
// pas charger toutes les ventes en mémoire pour compter.

import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, products, sales, stores, users } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isNaN(x) ? 0 : x;
}

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const maintenant = new Date();
  const il30j = new Date(maintenant.getTime() - 30 * 86_400_000);
  const il7j = new Date(maintenant.getTime() - 7 * 86_400_000);
  const dans7j = new Date(maintenant.getTime() + 7 * 86_400_000);

  const [
    boutiques,
    parPlan,
    utilisateurs,
    ventes,
    ventes30j,
    boutiquesActives,
    nouvelles7j,
    essaisBientotExpires,
    catalogue,
  ] = await Promise.all([
    db.select({ nb: sql<number>`count(*)::int` }).from(stores),
    db
      .select({ plan: stores.plan, nb: sql<number>`count(*)::int` })
      .from(stores)
      .groupBy(stores.plan),
    db.select({ nb: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        nb: sql<number>`count(*)::int`,
        montant: sql<string>`coalesce(sum(${sales.total}), 0)`,
      })
      .from(sales)
      .where(eq(sales.statut, "VALIDEE")),
    db
      .select({
        nb: sql<number>`count(*)::int`,
        montant: sql<string>`coalesce(sum(${sales.total}), 0)`,
      })
      .from(sales)
      .where(and(eq(sales.statut, "VALIDEE"), gte(sales.dateHeure, il30j))),
    db
      .select({ nb: sql<number>`count(distinct ${sales.storeId})::int` })
      .from(sales)
      .where(and(eq(sales.statut, "VALIDEE"), gte(sales.dateHeure, il30j))),
    db.select({ nb: sql<number>`count(*)::int` }).from(stores).where(gte(stores.creeLe, il7j)),
    // Les bornes de date passent par les helpers Drizzle (lte/gte) et non par un template `sql` :
    // interpolé dans du SQL brut, un objet Date n'est pas converti par le pilote et fait échouer
    // la requête.
    db
      .select({ nb: sql<number>`count(*)::int` })
      .from(stores)
      .where(
        and(
          eq(stores.plan, "ESSAI"),
          isNotNull(stores.essaiExpireLe),
          lte(stores.essaiExpireLe, dans7j),
          gte(stores.essaiExpireLe, maintenant)
        )
      ),
    Promise.all([
      db.select({ nb: sql<number>`count(*)::int` }).from(products),
      db.select({ nb: sql<number>`count(*)::int` }).from(clients),
    ]),
  ]);

  // Volume encaissé par mois sur 6 mois et classement des boutiques : les deux graphiques qui
  // disent le plus vite si la plateforme progresse et qui la fait vivre.
  const volumeMensuel = await db
    .select({
      mois: sql<string>`to_char(date_trunc('month', ${sales.dateHeure}), 'YYYY-MM')`,
      volume: sql<string>`coalesce(sum(${sales.total}), 0)`,
      ventes: sql<number>`count(*)::int`,
    })
    .from(sales)
    .where(and(eq(sales.statut, "VALIDEE"), gte(sales.dateHeure, new Date(maintenant.getTime() - 183 * 86_400_000))))
    .groupBy(sql`date_trunc('month', ${sales.dateHeure})`)
    .orderBy(sql`date_trunc('month', ${sales.dateHeure})`);

  const topBoutiques = await db
    .select({
      nom: stores.nom,
      volume: sql<string>`coalesce(sum(${sales.total}), 0)`,
    })
    .from(sales)
    .innerJoin(stores, eq(stores.id, sales.storeId))
    .where(eq(sales.statut, "VALIDEE"))
    .groupBy(stores.id, stores.nom)
    .orderBy(sql`sum(${sales.total}) desc`)
    .limit(5);

  // Courbe des inscriptions sur 12 semaines, pour voir la tendance d'un coup d'œil.
  const inscriptions = await db
    .select({
      semaine: sql<string>`to_char(date_trunc('week', ${stores.creeLe}), 'YYYY-MM-DD')`,
      nb: sql<number>`count(*)::int`,
    })
    .from(stores)
    .where(gte(stores.creeLe, new Date(maintenant.getTime() - 84 * 86_400_000)))
    .groupBy(sql`date_trunc('week', ${stores.creeLe})`)
    .orderBy(sql`date_trunc('week', ${stores.creeLe})`);

  return NextResponse.json({
    boutiques: boutiques[0]?.nb ?? 0,
    boutiquesActives30j: boutiquesActives[0]?.nb ?? 0,
    nouvellesBoutiques7j: nouvelles7j[0]?.nb ?? 0,
    essaisExpirantSous7j: essaisBientotExpires[0]?.nb ?? 0,
    utilisateurs: utilisateurs[0]?.nb ?? 0,
    produits: catalogue[0][0]?.nb ?? 0,
    clients: catalogue[1][0]?.nb ?? 0,
    ventes: ventes[0]?.nb ?? 0,
    volumeTotal: n(ventes[0]?.montant),
    ventes30j: ventes30j[0]?.nb ?? 0,
    volume30j: n(ventes30j[0]?.montant),
    parPlan: Object.fromEntries(parPlan.map((p) => [p.plan, p.nb])),
    inscriptions: inscriptions.map((i) => ({ semaine: i.semaine, nb: i.nb })),
    volumeMensuel: volumeMensuel.map((v) => ({ mois: v.mois, volume: n(v.volume), ventes: v.ventes })),
    topBoutiques: topBoutiques.map((b) => ({ nom: b.nom, volume: n(b.volume) })),
  });
}
