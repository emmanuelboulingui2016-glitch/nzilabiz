// Superadmin — vue d'ensemble de la plateforme.
//
// Toutes les agrégations sont faites en SQL : le nombre de boutiques peut grandir, la page ne doit
// pas charger toutes les ventes en mémoire pour compter.
//
// Les onze compteurs tiennent en une seule instruction. La version précédente les lançait en
// parallèle depuis le code : à travers le pooler en mode transaction, cet empilement de requêtes
// sur une même connexion produisait une fonction qui expirait au bout de cinq minutes, sans
// message d'erreur. Une instruction, un aller-retour, aucune ambiguïté.

import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sales, stores } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";

function n(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isNaN(x) ? 0 : x;
}

/**
 * Chronomètre une étape et la journalise. Une fonction sans serveur qui expire au bout de cinq
 * minutes ne dit rien de ce qu'elle attendait : ces repères transforment un 504 muet en une ligne
 * exploitable dans les journaux.
 */
async function etape<T>(nom: string, f: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    const r = await f();
    console.log(`stats: ${nom} en ${Date.now() - t} ms`);
    return r;
  } catch (e) {
    console.error(`stats: ${nom} ÉCHEC après ${Date.now() - t} ms —`, e instanceof Error ? e.message : e);
    throw e;
  }
}

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    return await calculer();
  } catch (e) {
    // Une erreur de base doit se voir tout de suite dans l'écran, pas au bout de cinq minutes.
    console.error("stats: abandon —", e);
    return NextResponse.json(
      { error: "Statistiques indisponibles pour le moment.", detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

async function calculer() {

  // Les bornes de date sont calculées en SQL (`now() - interval`) plutôt que passées depuis le
  // code : interpolé dans un template `sql` brut, un objet Date n'est pas converti par le pilote
  // et fait échouer la requête.
  const [brut] = await etape("compteurs", () => db.execute<Record<string, unknown>>(sql`
    select
      (select count(*)::int from stores)                                                as boutiques,
      (select count(*)::int from stores where cree_le >= now() - interval '7 days')     as nouvelles7j,
      (select count(*)::int from stores where programme_test)                           as testeurs,
      (select count(*)::int from stores
         where plan = 'ESSAI' and essai_expire_le between now() and now() + interval '7 days')
                                                                                        as essais_bientot,
      (select count(*)::int from users)                                                 as utilisateurs,
      (select count(*)::int from products)                                              as produits,
      (select count(*)::int from clients)                                               as clients,
      (select count(*)::int from sales where statut = 'VALIDEE')                        as ventes,
      (select coalesce(sum(total), 0) from sales where statut = 'VALIDEE')              as volume_total,
      (select count(*)::int from sales
         where statut = 'VALIDEE' and date_heure >= now() - interval '30 days')          as ventes30j,
      (select coalesce(sum(total), 0) from sales
         where statut = 'VALIDEE' and date_heure >= now() - interval '30 days')          as volume30j,
      (select count(distinct store_id)::int from sales
         where statut = 'VALIDEE' and date_heure >= now() - interval '30 days')          as actives30j
  `));

  const s = (brut ?? {}) as Record<string, unknown>;

  // Quatre regroupements, qui ne peuvent pas tenir sur une ligne unique. Enchaînés et non lancés
  // en parallèle : à travers le pooler en mode transaction, plusieurs requêtes émises en même
  // temps depuis une même requête HTTP ne reviennent jamais — la fonction expire au bout de cinq
  // minutes sans erreur. Quatre allers-retours de 200 ms restent imperceptibles.
  const parPlan = await etape("parPlan", () =>
    db.select({ plan: stores.plan, nb: sql<number>`count(*)::int` }).from(stores).groupBy(stores.plan));

  const volumeMensuel = await etape("volumeMensuel", () =>
    db
      .select({
        mois: sql<string>`to_char(date_trunc('month', ${sales.dateHeure}), 'YYYY-MM')`,
        volume: sql<string>`coalesce(sum(${sales.total}), 0)`,
        ventes: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(and(eq(sales.statut, "VALIDEE"), sql`${sales.dateHeure} >= now() - interval '6 months'`))
      .groupBy(sql`date_trunc('month', ${sales.dateHeure})`)
      .orderBy(sql`date_trunc('month', ${sales.dateHeure})`));

  const topBoutiques = await etape("topBoutiques", () =>
    db
      .select({ nom: stores.nom, volume: sql<string>`coalesce(sum(${sales.total}), 0)` })
      .from(sales)
      .innerJoin(stores, eq(stores.id, sales.storeId))
      .where(eq(sales.statut, "VALIDEE"))
      .groupBy(stores.id, stores.nom)
      .orderBy(sql`sum(${sales.total}) desc`)
      .limit(5));

  const inscriptions = await etape("inscriptions", () =>
    db
      .select({
        semaine: sql<string>`to_char(date_trunc('week', ${stores.creeLe}), 'YYYY-MM-DD')`,
        nb: sql<number>`count(*)::int`,
      })
      .from(stores)
      .where(gte(stores.creeLe, sql`now() - interval '12 weeks'`))
      .groupBy(sql`date_trunc('week', ${stores.creeLe})`)
      .orderBy(sql`date_trunc('week', ${stores.creeLe})`));

  return NextResponse.json({
    boutiques: n(s.boutiques),
    boutiquesActives30j: n(s.actives30j),
    nouvellesBoutiques7j: n(s.nouvelles7j),
    essaisExpirantSous7j: n(s.essais_bientot),
    boutiquesTesteuses: n(s.testeurs),
    utilisateurs: n(s.utilisateurs),
    produits: n(s.produits),
    clients: n(s.clients),
    ventes: n(s.ventes),
    volumeTotal: n(s.volume_total),
    ventes30j: n(s.ventes30j),
    volume30j: n(s.volume30j),
    parPlan: Object.fromEntries(parPlan.map((p) => [p.plan, p.nb])),
    inscriptions: inscriptions.map((i) => ({ semaine: i.semaine, nb: i.nb })),
    volumeMensuel: volumeMensuel.map((v) => ({ mois: v.mois, volume: n(v.volume), ventes: v.ventes })),
    topBoutiques: topBoutiques.map((b) => ({ nom: b.nom, volume: n(b.volume) })),
  });
}
