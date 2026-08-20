// Agrégation des données du tableau de bord — §5 du cahier des charges.
// Utilisé à la fois par la page serveur (src/app/(app)/dashboard/page.tsx) et par la route API
// GET /api/dashboard (pour un éventuel rafraîchissement côté client sans recharger la page).
//
// Deux règles gouvernent ce fichier, apprises à ses dépens.
//
// 1. On compte en SQL, jamais en JavaScript. La version précédente chargeait toutes les ventes du
//    jour avec leurs lignes et le produit complet de chaque ligne, puis TOUS les paiements à crédit
//    et TOUS les remboursements de la boutique depuis son ouverture — pour n'en faire que des
//    sommes. Le coût grandissait indéfiniment avec l'historique : imperceptible sur une boutique de
//    démonstration, insupportable après un an d'activité. Et comme les photos de produits sont
//    stockées en base64 dans la base, chaque ligne de vente traînait une image entière derrière
//    elle, uniquement pour afficher un nom.
//
// 2. Les requêtes s'enchaînent, elles ne se lancent pas en parallèle. À travers le pooler en mode
//    transaction, plusieurs requêtes émises simultanément depuis une même requête HTTP ne
//    reviennent pas (voir README). Ce n'est pas un problème : six allers-retours vers une base
//    située dans la même région coûtent quelques millisecondes, là où la version « parallèle »
//    rapatriait des milliers de lignes.

import { sql } from "drizzle-orm";
import { format, startOfDay, subDays, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { db } from "@/db/client";
import type { CashCountSummary, DashboardData, LowStockRow, RecentSaleRow, TopProductRow, WeeklySalesPoint } from "./types";

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT: "Crédit",
};

function n(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function pctDelta(today: number, yesterday: number): number | null {
  if (yesterday === 0) {
    if (today === 0) return null;
    return 100;
  }
  return ((today - yesterday) / yesterday) * 100;
}

/**
 * Les bornes de journée sont calculées par PostgreSQL et non par le code : la fonction s'exécute à
 * Dublin, le commerçant est au Gabon. `current_date` dans le fuseau de la boutique donne « le jour
 * du commerçant », pas celui du serveur — sans quoi les chiffres du matin appartiendraient encore
 * à la veille.
 */
const FUSEAU = "Africa/Libreville";

export async function getDashboardData(storeId: string): Promise<DashboardData> {
  // ---------------------------------------------------------------------------------------------
  // 1. Tous les compteurs scalaires en une instruction.
  // ---------------------------------------------------------------------------------------------
  const [brut] = await db.execute<Record<string, unknown>>(sql`
    with bornes as (
      select
        (date_trunc('day', now() at time zone ${FUSEAU}) at time zone ${FUSEAU})              as debut_jour,
        (date_trunc('day', now() at time zone ${FUSEAU}) + interval '1 day') at time zone ${FUSEAU} as fin_jour,
        (date_trunc('day', now() at time zone ${FUSEAU}) - interval '1 day') at time zone ${FUSEAU} as debut_hier
    )
    select
      (select coalesce(sum(s.total), 0) from sales s, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE'
          and s.date_heure >= b.debut_jour and s.date_heure < b.fin_jour)          as ca_jour,
      (select count(*)::int from sales s, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE'
          and s.date_heure >= b.debut_jour and s.date_heure < b.fin_jour)          as ventes_jour,
      (select coalesce(sum(s.total), 0) from sales s, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE'
          and s.date_heure >= b.debut_hier and s.date_heure < b.debut_jour)        as ca_hier,
      (select count(*)::int from sales s, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE'
          and s.date_heure >= b.debut_hier and s.date_heure < b.debut_jour)        as ventes_hier,

      -- Créances : tout ce qui a été pris à crédit, moins tout ce qui a été remboursé.
      (select coalesce(sum(p.montant), 0) from payments p join sales s on s.id = p.sale_id
        where s.store_id = ${storeId} and s.statut = 'VALIDEE' and p.mode = 'CREDIT')  as credit_total,
      (select coalesce(sum(r.montant), 0) from debt_repayments r join clients c on c.id = r.client_id
        where c.store_id = ${storeId})                                                 as rembourse_total,

      (select coalesce(sum(e.montant), 0) from expenses e, bornes b
        where e.store_id = ${storeId} and e.date >= b.debut_jour and e.date < b.fin_jour)   as depenses_jour,
      (select coalesce(sum(e.montant), 0) from expenses e, bornes b
        where e.store_id = ${storeId} and e.mode_reglement = 'ESPECES'
          and e.date >= b.debut_jour and e.date < b.fin_jour)                              as depenses_especes,

      -- Encaissé du jour, ventilé par mode de règlement.
      (select coalesce(sum(p.montant), 0) from payments p join sales s on s.id = p.sale_id, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE' and p.mode = 'ESPECES'
          and s.date_heure >= b.debut_jour and s.date_heure < b.fin_jour)               as encaisse_especes,
      (select coalesce(sum(p.montant), 0) from payments p join sales s on s.id = p.sale_id, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE' and p.mode = 'MOBILE_MONEY'
          and s.date_heure >= b.debut_jour and s.date_heure < b.fin_jour)               as encaisse_mobile,
      (select coalesce(sum(p.montant), 0) from payments p join sales s on s.id = p.sale_id, bornes b
        where s.store_id = ${storeId} and s.statut = 'VALIDEE' and p.mode = 'CREDIT'
          and s.date_heure >= b.debut_jour and s.date_heure < b.fin_jour)               as encaisse_credit
  `);

  const s = brut ?? {};
  const caDuJour = n(s.ca_jour);
  const ventesDuJour = n(s.ventes_jour);
  const caHier = n(s.ca_hier);
  const ventesHier = n(s.ventes_hier);
  const creancesEnCours = Math.max(0, n(s.credit_total) - n(s.rembourse_total));
  const depensesDuJour = n(s.depenses_jour);
  const depensesEspeces = n(s.depenses_especes);
  const especes = n(s.encaisse_especes);
  const mobileMoney = n(s.encaisse_mobile);
  const credit = n(s.encaisse_credit);

  // ---------------------------------------------------------------------------------------------
  // 2. Les deux comptages de caisse du jour, ouverture et fermeture, en une instruction.
  // ---------------------------------------------------------------------------------------------
  const comptages = await db.execute<Record<string, unknown>>(sql`
    select distinct on (type) type, id, montant_saisi, montant_theorique, ecart, date
    from cash_counts
    where store_id = ${storeId}
      and date >= (date_trunc('day', now() at time zone ${FUSEAU}) at time zone ${FUSEAU})
      and date <  ((date_trunc('day', now() at time zone ${FUSEAU}) + interval '1 day') at time zone ${FUSEAU})
    order by type, date desc
  `);

  const versComptage = (l: Record<string, unknown> | undefined): CashCountSummary =>
    l
      ? {
          id: String(l.id),
          montantSaisi: n(l.montant_saisi),
          montantTheorique: l.montant_theorique === null ? null : n(l.montant_theorique),
          ecart: l.ecart === null ? null : n(l.ecart),
          date: new Date(String(l.date)).toISOString(),
        }
      : null;

  const cashCountOuverture = versComptage(comptages.find((l) => l.type === "OUVERTURE"));
  const cashCountFermeture = versComptage(comptages.find((l) => l.type === "FERMETURE"));
  const fondOuverture = cashCountOuverture ? cashCountOuverture.montantSaisi : 0;

  // ---------------------------------------------------------------------------------------------
  // 3. Ventes de la semaine — un total par jour, calculé par la base.
  // ---------------------------------------------------------------------------------------------
  const parJour = await db.execute<Record<string, unknown>>(sql`
    select to_char((date_heure at time zone ${FUSEAU})::date, 'YYYY-MM-DD') as jour,
           coalesce(sum(total), 0) as total
    from sales
    where store_id = ${storeId} and statut = 'VALIDEE'
      and date_heure >= ((date_trunc('day', now() at time zone ${FUSEAU}) - interval '6 days') at time zone ${FUSEAU})
    group by 1
  `);

  const totauxParJour = new Map<string, number>();
  for (const l of parJour) totauxParJour.set(String(l.jour), n(l.total));

  const maintenant = new Date();
  const weeklySales: WeeklySalesPoint[] = eachDayOfInterval({
    start: startOfDay(subDays(maintenant, 6)),
    end: startOfDay(maintenant),
  }).map((d) => {
    const cle = format(d, "yyyy-MM-dd");
    return { date: cle, label: format(d, "EEE dd/MM", { locale: fr }), total: totauxParJour.get(cle) ?? 0 };
  });

  // ---------------------------------------------------------------------------------------------
  // 4. Alertes de stock. Colonnes énumérées : `photo_url` contient une image entière en base64 et
  //    n'a rien à faire dans une liste de cinq noms.
  // ---------------------------------------------------------------------------------------------
  const stockFaible = await db.execute<Record<string, unknown>>(sql`
    select id, nom, quantite_stock, seuil_alerte, unite
    from products
    where store_id = ${storeId} and quantite_stock <= seuil_alerte
    order by quantite_stock asc
    limit 5
  `);

  const lowStock: LowStockRow[] = stockFaible.map((p) => ({
    id: String(p.id),
    nom: String(p.nom),
    quantiteStock: n(p.quantite_stock),
    seuilAlerte: n(p.seuil_alerte),
    unite: String(p.unite),
  }));

  // ---------------------------------------------------------------------------------------------
  // 5. Meilleurs produits du jour — regroupés par la base, cinq lignes en retour.
  // ---------------------------------------------------------------------------------------------
  const meilleurs = await db.execute<Record<string, unknown>>(sql`
    select i.product_id, max(pr.nom) as nom,
           coalesce(sum(i.quantite), 0) as quantite,
           coalesce(sum(i.sous_total), 0) as total
    from sale_items i
    join sales s on s.id = i.sale_id
    left join products pr on pr.id = i.product_id
    where s.store_id = ${storeId} and s.statut = 'VALIDEE'
      and s.date_heure >= (date_trunc('day', now() at time zone ${FUSEAU}) at time zone ${FUSEAU})
      and s.date_heure <  ((date_trunc('day', now() at time zone ${FUSEAU}) + interval '1 day') at time zone ${FUSEAU})
    group by i.product_id
    order by total desc
    limit 5
  `);

  const topProducts: TopProductRow[] = meilleurs.map((r) => ({
    productId: String(r.product_id),
    nom: r.nom ? String(r.nom) : "Produit",
    quantite: n(r.quantite),
    total: n(r.total),
  }));

  // ---------------------------------------------------------------------------------------------
  // 6. Dix dernières ventes du jour. Le libellé d'article et le mode de règlement sont composés par
  //    la base : c'est un aller-retour au lieu d'un par vente.
  // ---------------------------------------------------------------------------------------------
  const dernieres = await db.execute<Record<string, unknown>>(sql`
    select s.id, s.numero, s.date_heure, s.total,
           (select pr.nom from sale_items i left join products pr on pr.id = i.product_id
             where i.sale_id = s.id order by i.id limit 1)               as premier_article,
           (select count(*)::int from sale_items i where i.sale_id = s.id)    as nb_lignes,
           (select coalesce(sum(i.quantite), 0) from sale_items i where i.sale_id = s.id) as qte,
           (select array_agg(distinct p.mode::text) from payments p where p.sale_id = s.id) as modes
    from sales s
    where s.store_id = ${storeId} and s.statut = 'VALIDEE'
      and s.date_heure >= (date_trunc('day', now() at time zone ${FUSEAU}) at time zone ${FUSEAU})
      and s.date_heure <  ((date_trunc('day', now() at time zone ${FUSEAU}) + interval '1 day') at time zone ${FUSEAU})
    order by s.date_heure desc
    limit 10
  `);

  const recentSales: RecentSaleRow[] = dernieres.map((r) => {
    const premier = r.premier_article ? String(r.premier_article) : "—";
    const autres = n(r.nb_lignes) - 1;
    const modes = Array.isArray(r.modes) ? (r.modes as string[]).filter(Boolean) : [];
    return {
      id: String(r.id),
      numero: String(r.numero),
      heure: format(new Date(String(r.date_heure)), "HH:mm"),
      article: autres > 0 ? `${premier} +${autres}` : premier,
      qte: n(r.qte),
      total: n(r.total),
      paiement: modes.length > 1 ? "Mixte" : MODE_LABELS[modes[0] ?? ""] ?? "—",
    };
  });

  return {
    kpi: {
      caDuJour,
      caHier,
      caDeltaPct: pctDelta(caDuJour, caHier),
      ventesDuJour,
      ventesHier,
      ventesDeltaPct: pctDelta(ventesDuJour, ventesHier),
      creancesEnCours,
      depensesDuJour,
    },
    encaisse: { especes, mobileMoney, credit },
    caisse: {
      fondOuverture,
      especesEncaissees: especes,
      depensesEspeces,
      resteEnCaisse: fondOuverture + especes - depensesEspeces,
      cashCountOuverture,
      cashCountFermeture,
      ouvertureManquante: !cashCountOuverture,
    },
    weeklySales,
    lowStock,
    topProducts,
    recentSales,
  };
}
