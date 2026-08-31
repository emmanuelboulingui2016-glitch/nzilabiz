/**
 * Réseau de boutiques — la formule Entreprise.
 *
 * Toute l'application est déjà cloisonnée par `storeId` : chaque requête, chaque écran, chaque
 * route API lit la boutique dans la session et ne voit rien d'autre. Le réseau ne touche donc à
 * aucun de ces écrans. Il ajoute exactement deux choses :
 *
 *   1. un compte peut avoir accès à plusieurs boutiques (`store_memberships`) ;
 *   2. il peut passer de l'une à l'autre — la bascule réécrit `storeId` dans la session.
 *
 * Le reste suit tout seul, et c'est voulu : une fonctionnalité qui aurait exigé de modifier les
 * soixante routes existantes aurait été une fonctionnalité fausse quelque part.
 *
 * Le contrat d'abonnement, lui, n'est pas dupliqué. Une boutique rattachée pointe vers sa maison
 * mère (`stores.maison_mere_id`) et c'est l'échéance de la maison mère qui gouverne l'accès de
 * tout le réseau — voir `src/lib/abonnement.ts`. Un réseau, un contrat, une facture.
 */

import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Role } from "@/lib/auth/rbac";

/**
 * Plafond volontairement haut mais fini. Sans limite, une boucle malencontreuse côté client peut
 * créer des milliers de boutiques vides en quelques secondes, et chacune est une ligne de plus
 * dans tous les écrans d'administration.
 */
export const MAX_BOUTIQUES_RESEAU = 50;

const FUSEAU = "Africa/Libreville";

export type BoutiqueDuReseau = {
  id: string;
  nom: string;
  /** Rôle du compte **dans cette boutique-là** : patron chez lui, gérant ailleurs, c'est possible. */
  role: Role;
  /** Boutique porteuse du contrat d'abonnement pour ce réseau. */
  contratId: string;
  /** Boutique d'origine du compte, celle où il a été créé. */
  origine: boolean;
};

function estRole(v: unknown): v is Role {
  return v === "PATRON" || v === "GERANT" || v === "VENDEUR";
}

/**
 * Boutiques auxquelles ce compte a accès : la sienne, plus ses rattachements.
 *
 * Un compte ordinaire renvoie une seule ligne et le réseau reste invisible — aucun écran ne
 * change tant qu'il n'y a qu'une boutique.
 */
export const boutiquesAccessibles = cache(async (userId: string): Promise<BoutiqueDuReseau[]> => {
  try {
    return await lireBoutiques(userId);
  } catch (e) {
    // Ce calque s'exécute au-dessus de chaque page. Une lecture du réseau qui échoue ne doit pas
    // faire tomber l'application entière pour une fonctionnalité dont l'immense majorité des
    // commerçants n'a pas l'usage — même choix que la vérification de révocation, la limitation de
    // débit et l'état d'abonnement. On retombe sur la seule boutique du compte, en le disant.
    console.error("réseau : boutiques illisibles —", e instanceof Error ? e.message : e);
    return boutiqueSeule(userId);
  }
});

/** Repli : la boutique d'origine du compte, sans les rattachements. */
async function boutiqueSeule(userId: string): Promise<BoutiqueDuReseau[]> {
  try {
    const [l] = await db.execute<Record<string, unknown>>(sql`
      select s.id, s.nom, u.role::text as role
      from users u
      join stores s on s.id = u.store_id
      where u.id = ${userId}
    `);
    if (!l) return [];
    const id = String(l.id);
    return [{ id, nom: String(l.nom ?? ""), role: estRole(l.role) ? l.role : "VENDEUR", contratId: id, origine: true }];
  } catch {
    return [];
  }
}

async function lireBoutiques(userId: string): Promise<BoutiqueDuReseau[]> {
  const lignes = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.nom, coalesce(s.maison_mere_id, s.id) as contrat_id, a.role::text as role, a.origine
    from (
      select u.store_id as store_id, u.role as role, true as origine
      from users u
      where u.id = ${userId}
      union all
      select m.store_id, m.role, false
      from store_memberships m
      join users u2 on u2.id = m.user_id
      where m.user_id = ${userId} and m.store_id <> u2.store_id
    ) a
    join stores s on s.id = a.store_id
    order by a.origine desc, s.nom asc
  `);

  const vues = new Set<string>();
  const boutiques: BoutiqueDuReseau[] = [];
  for (const l of lignes) {
    const id = String(l.id);
    if (vues.has(id)) continue;
    vues.add(id);
    boutiques.push({
      id,
      nom: String(l.nom ?? ""),
      role: estRole(l.role) ? l.role : "VENDEUR",
      contratId: String(l.contrat_id ?? id),
      origine: l.origine === true,
    });
  }
  return boutiques;
}

/**
 * Rôle du compte dans cette boutique, ou `null` s'il n'y a pas accès.
 *
 * C'est **la** vérification de la bascule : elle interroge la base, jamais le jeton. Un jeton dit
 * seulement où l'on était, il ne dit pas où l'on a le droit d'aller.
 */
export async function roleDansBoutique(userId: string, storeId: string): Promise<Role | null> {
  const boutiques = await boutiquesAccessibles(userId);
  return boutiques.find((b) => b.id === storeId)?.role ?? null;
}

export type ChiffresBoutique = {
  caJour: number;
  ventesJour: number;
  caMois: number;
  stockBas: number;
};

/**
 * Chiffres du jour et du mois pour plusieurs boutiques, en une seule instruction.
 *
 * Les bornes de journée sont calculées par PostgreSQL dans le fuseau du commerçant, comme au
 * tableau de bord : la fonction s'exécute à Dublin, la boutique est au Gabon.
 */
export async function chiffresDesBoutiques(ids: string[]): Promise<Map<string, ChiffresBoutique>> {
  const resultat = new Map<string, ChiffresBoutique>();
  if (ids.length === 0) return resultat;

  // Liste de paramètres, jamais une concaténation de chaînes : ces identifiants viennent de la
  // base, mais la règle ne souffre pas d'exception.
  const liste = sql.join(
    ids.map((i) => sql`${i}`),
    sql`, `
  );

  const lignes = await db.execute<Record<string, unknown>>(sql`
    with bornes as (
      select
        (date_trunc('day',   now() at time zone ${FUSEAU}) at time zone ${FUSEAU})                    as debut_jour,
        ((date_trunc('day',  now() at time zone ${FUSEAU}) + interval '1 day') at time zone ${FUSEAU}) as fin_jour,
        (date_trunc('month', now() at time zone ${FUSEAU}) at time zone ${FUSEAU})                    as debut_mois
    )
    select
      s.id,
      (select coalesce(sum(v.total), 0) from sales v, bornes b
        where v.store_id = s.id and v.statut = 'VALIDEE'
          and v.date_heure >= b.debut_jour and v.date_heure < b.fin_jour)   as ca_jour,
      (select count(*)::int from sales v, bornes b
        where v.store_id = s.id and v.statut = 'VALIDEE'
          and v.date_heure >= b.debut_jour and v.date_heure < b.fin_jour)   as ventes_jour,
      (select coalesce(sum(v.total), 0) from sales v, bornes b
        where v.store_id = s.id and v.statut = 'VALIDEE'
          and v.date_heure >= b.debut_mois)                                 as ca_mois,
      (select count(*)::int from products p
        where p.store_id = s.id and p.quantite_stock <= p.seuil_alerte)     as stock_bas
    from stores s
    where s.id in (${liste})
  `);

  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v ?? 0);
    return Number.isNaN(x) ? 0 : x;
  };

  for (const l of lignes) {
    resultat.set(String(l.id), {
      caJour: n(l.ca_jour),
      ventesJour: n(l.ventes_jour),
      caMois: n(l.ca_mois),
      stockBas: n(l.stock_bas),
    });
  }
  return resultat;
}

/** Nombre de boutiques déjà rattachées à ce contrat, maison mère comprise. */
export async function tailleDuReseau(contratId: string): Promise<number> {
  const [ligne] = await db.execute<Record<string, unknown>>(sql`
    select count(*)::int as total
    from stores s
    where s.id = ${contratId} or s.maison_mere_id = ${contratId}
  `);
  return Number(ligne?.total ?? 1);
}
