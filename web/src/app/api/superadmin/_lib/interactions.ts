// Superadmin — nombre d'« interactions » par boutique, à J / mois / année.
//
// Précédent dont ce module s'inspire directement : `chiffresDesBoutiques` dans
// `src/lib/reseau.ts`. Mêmes principes, qu'on ne modifie pas ici mais qu'on répète volontairement :
//   - une seule requête pour toutes les boutiques demandées, jamais une boucle qui interroge la
//     base boutique par boutique (le pooler Supavisor en mode transaction ne supporte pas plusieurs
//     requêtes en parallèle sur une même connexion, et une boucle séquentielle deviendrait de toute
//     façon linéairement plus lente à mesure que le parc grandit) ;
//   - les bornes de journée/mois/année sont calculées par PostgreSQL dans le fuseau du commerçant
//     (`Africa/Libreville`), pas par le serveur Node qui peut tourner n'importe où dans le monde —
//     sinon « aujourd'hui » bascule en pleine journée de vente pour un commerçant du Gabon.
//
// La constante FUSEAU est dupliquée depuis `src/lib/reseau.ts` plutôt qu'importée : ce fichier
// n'exporte pas la constante, et ce module reste volontairement dans le périmètre de
// `src/app/api/superadmin/**`.
//
// Définition d'une « interaction » : un geste métier de haut niveau, horodaté, qui montre que
// quelqu'un se sert réellement du logiciel ce jour-là — pas le détail d'un panier. On compte :
//   - une vente enregistrée (une vente de quinze articles ne compte qu'une fois, pas quinze) ;
//   - une dépense enregistrée ;
//   - un mouvement de stock volontaire — réception ou ajustement — mais pas les sorties
//     automatiques générées ligne par ligne à chaque vente : elles gonfleraient le chiffre sans
//     rien dire de plus que la vente elle-même, déjà comptée ;
//   - une connexion applicative : un appareil (`devices`) dont la dernière activité tombe dans la
//     période.
// Les journaux de synchronisation (`sync_logs`) ne sont volontairement pas comptés : ils ne
// s'écrivent que sur un écart de prix détecté ou un conflit hors-ligne, pas à chaque usage normal —
// les inclure ferait presque toujours zéro, sans rien dire de l'activité réelle de la boutique.
//
// Les trois compteurs sont cumulatifs, comme `caJour`/`caMois` dans `chiffresDesBoutiques` :
// « mois » inclut « jour », « année » inclut « mois ». Une boutique sans la moindre activité
// obtient trois zéros — jamais une ligne absente ni `null` — grâce au `left join` depuis `stores`.

import { sql } from "drizzle-orm";
import { db } from "@/db/client";

const FUSEAU = "Africa/Libreville";

export type InteractionsBoutique = { jour: number; mois: number; annee: number };

export async function interactionsDesBoutiques(ids: string[]): Promise<Map<string, InteractionsBoutique>> {
  const resultat = new Map<string, InteractionsBoutique>();
  if (ids.length === 0) return resultat;

  // Liste de paramètres, jamais une concaténation de chaînes : ces identifiants viennent de la
  // base, mais la règle ne souffre pas d'exception (voir `chiffresDesBoutiques`).
  const liste = sql.join(
    ids.map((i) => sql`${i}`),
    sql`, `
  );

  // `evenements` est borné à l'année en cours dès la lecture des tables sources : sans cette
  // borne, chaque union scannerait tout l'historique de la boutique pour ne garder ensuite que
  // les trois derniers compteurs.
  const lignes = await db.execute<Record<string, unknown>>(sql`
    with bornes as (
      select
        (date_trunc('day',   now() at time zone ${FUSEAU}) at time zone ${FUSEAU})                    as debut_jour,
        ((date_trunc('day',  now() at time zone ${FUSEAU}) + interval '1 day') at time zone ${FUSEAU}) as fin_jour,
        (date_trunc('month', now() at time zone ${FUSEAU}) at time zone ${FUSEAU})                    as debut_mois,
        (date_trunc('year',  now() at time zone ${FUSEAU}) at time zone ${FUSEAU})                    as debut_annee
    ),
    evenements as (
      select store_id, date_heure as quand from sales
        where store_id in (${liste}) and date_heure >= (select debut_annee from bornes)
      union all
      select store_id, date as quand from expenses
        where store_id in (${liste}) and date >= (select debut_annee from bornes)
      union all
      select p.store_id as store_id, m.date as quand
        from stock_movements m
        join products p on p.id = m.product_id
        where m.type in ('RECEPTION', 'AJUSTEMENT')
          and p.store_id in (${liste})
          and m.date >= (select debut_annee from bornes)
      union all
      select store_id, derniere_activite as quand from devices
        where store_id in (${liste}) and derniere_activite >= (select debut_annee from bornes)
    )
    select
      s.id,
      count(*) filter (where e.quand >= b.debut_jour  and e.quand < b.fin_jour) as jour,
      count(*) filter (where e.quand >= b.debut_mois)                          as mois,
      count(*) filter (where e.quand >= b.debut_annee)                         as annee
    from stores s
    cross join bornes b
    left join evenements e on e.store_id = s.id
    where s.id in (${liste})
    group by s.id
  `);

  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v ?? 0);
    return Number.isNaN(x) ? 0 : x;
  };

  for (const l of lignes) {
    resultat.set(String(l.id), { jour: n(l.jour), mois: n(l.mois), annee: n(l.annee) });
  }
  return resultat;
}
