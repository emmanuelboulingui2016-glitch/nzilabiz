// Superadmin — fiche d'une boutique et actions d'administration.
//
// GET    : détail, activité, interactions et paiements. L'équipe n'est jamais listée nommément —
//          seul le titulaire (rôle PATRON) l'est, le reste de l'équipe n'apparaît qu'en comptage
//          (`effectif`).
// PATCH  : changer le plan, fixer ou prolonger une échéance (essai ou abonnement), ou fixer le
//          tarif Entreprise négocié — ce qui active la formule et émet une demande de paiement.
// DELETE : supprimer la boutique et toutes ses données. Protégé par la saisie exacte du nom, comme
//          la suppression par le Patron lui-même — un clic de trop ne doit pas effacer le commerce
//          de quelqu'un.

import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { paymentRequests, sales, stores, users } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { interactionsDesBoutiques } from "../../_lib/interactions";
import { emettreDemandePaiement } from "@/lib/paiements";
import { CYCLES, type Cycle } from "@/lib/tarifs";

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isNaN(x) ? 0 : x;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const boutique = await db.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!boutique) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  // Enchaînées et non lancées en parallèle : à travers le pooler en mode transaction, plusieurs
  // requêtes émises en même temps depuis une même requête HTTP ne reviennent jamais, et la
  // fonction expire au bout de cinq minutes sans erreur exploitable.
  //
  // Confidentialité : l'administration de la plateforme ne doit pas voir nommément les employés
  // (gérants, vendeurs) d'une boutique cliente — seul le patron reste identifiable, parce que
  // c'est lui l'interlocuteur commercial (facturation, support). La coupure se fait ici, à la
  // source : `nom` et `email` ne sont jamais lus pour un rôle autre que PATRON, ils ne quittent
  // donc jamais la base pour ces comptes-là.
  const titulaires = await db
      .select({
        id: users.id,
        nom: users.nom,
        email: users.email,
        telephone: users.telephone,
        derniereConnexion: users.derniereConnexion,
        desactiveLe: users.desactiveLe,
        creeLe: users.creeLe,
      })
      .from(users)
      .where(and(eq(users.storeId, id), eq(users.role, "PATRON")))
      .orderBy(users.creeLe);

  const dernieresVentes = await db
      .select({ id: sales.id, numero: sales.numero, total: sales.total, dateHeure: sales.dateHeure, statut: sales.statut })
      .from(sales)
      .where(eq(sales.storeId, id))
      .orderBy(desc(sales.dateHeure))
      .limit(10);

  // Usage réel des modules. Une seule requête : chaque aller-retour vers la base coûte ~200 ms
  // depuis l'hébergeur, et il y a douze compteurs. Les noms de tables sont écrits en clair plutôt
  // qu'interpolés depuis le schéma — une interpolation de colonne dans une sous-requête corrélée
  // se résout silencieusement sur la mauvaise table et renvoie zéro sans la moindre erreur.
  const [usage] = await db.execute<Record<string, unknown>>(sql`
    select
      (select count(*) from sales where store_id = ${id})                                    as ventes_nb,
      (select count(*) from sales where store_id = ${id} and statut = 'VALIDEE')              as ventes_validees,
      (select coalesce(sum(total), 0) from sales
         where store_id = ${id} and statut = 'VALIDEE')                                       as volume_total,
      (select coalesce(sum(montant), 0) from expenses where store_id = ${id})                 as depenses_total,
      (select max(date_heure) from sales where store_id = ${id})                             as ventes_dernier,
      (select count(*) from sales where store_id = ${id} and statut = 'ANNULEE')              as ventes_annulees,
      (select count(*) from products where store_id = ${id})                                 as produits_nb,
      (select count(*) from products where store_id = ${id}
         and quantite_stock <= seuil_alerte)                                                 as produits_alerte,
      (select max(m.date) from stock_movements m
         join products p on p.id = m.product_id where p.store_id = ${id})                     as stock_dernier,
      (select count(*) from clients where store_id = ${id})                                  as clients_nb,
      (select max(cree_le) from clients where store_id = ${id})                              as clients_dernier,
      (select count(*) from payments pa join sales sa on sa.id = pa.sale_id
         where sa.store_id = ${id} and pa.mode = 'CREDIT')                                   as credits_nb,
      (select count(*) from debt_repayments r join clients c on c.id = r.client_id
         where c.store_id = ${id})                                                            as remboursements_nb,
      (select max(r.date) from debt_repayments r join clients c on c.id = r.client_id
         where c.store_id = ${id})                                                            as creances_dernier,
      (select count(*) from expenses where store_id = ${id})                                 as depenses_nb,
      (select max(date) from expenses where store_id = ${id})                                as depenses_dernier,
      (select count(*) from documents where store_id = ${id})                                as documents_nb,
      (select max(date) from documents where store_id = ${id})                               as documents_dernier,
      (select count(*) from cash_counts where store_id = ${id})                              as caisse_nb,
      (select max(date) from cash_counts where store_id = ${id})                             as caisse_dernier,
      (select count(*) from devices where store_id = ${id} and not revoque)                  as appareils_nb,
      (select max(derniere_activite) from devices where store_id = ${id})                    as appareils_dernier,
      (select count(*) from invitations where store_id = ${id})                              as invitations_nb,
      (select count(*) from invitations where store_id = ${id} and utilise_le is not null)   as invitations_utilisees,
      (select count(*) from support_tickets where store_id = ${id})                          as support_nb,
      (select max(cree_le) from support_tickets where store_id = ${id})                      as support_dernier,
      (select count(*) from sync_logs where store_id = ${id})                                as sync_nb,
      (select count(*) from sync_logs where store_id = ${id} and statut = 'ECHEC')           as sync_echecs,
      (select max(horodatage) from sync_logs where store_id = ${id})                         as sync_dernier,
      -- Effectif par rôle, en comptage seulement : jamais un nom pour un gérant ou un vendeur,
      -- ici on ne lit même pas la colonne « nom » de ces comptes-là.
      (select count(*) from users where store_id = ${id})                                    as equipe_total,
      (select count(*) from users where store_id = ${id} and desactive_le is null)            as equipe_actifs,
      (select count(*) from users where store_id = ${id} and role = 'PATRON')                 as equipe_patrons,
      (select count(*) from users where store_id = ${id} and role = 'GERANT')                 as equipe_gerants,
      (select count(*) from users where store_id = ${id} and role = 'VENDEUR')                as equipe_vendeurs
  `);

  const u = (usage ?? {}) as Record<string, unknown>;
  const nb = (k: string) => Number(u[k] ?? 0);
  const quand = (k: string) => (u[k] ? new Date(u[k] as string).toISOString() : null);

  // Réseau Entreprise : cette boutique est-elle rattachée à une maison mère, ou en porte-t-elle ?
  // L'information change ce que l'administration a le droit de modifier ici, elle ne peut pas être
  // laissée de côté.
  const maisonMere = boutique.maisonMereId
    ? await db.query.stores.findFirst({ where: eq(stores.id, boutique.maisonMereId), columns: { nom: true } })
    : null;
  const [compte] = await db.execute<Record<string, unknown>>(sql`
    select count(*)::int as total from stores where maison_mere_id = ${id}
  `);
  const rattachees = Number(compte?.total ?? 0);

  // Interactions du jour/mois/année : même fonction que la liste des boutiques (voir
  // `interactionsDesBoutiques`), appelée ici avec une seule boutique.
  const interactions = (await interactionsDesBoutiques([id])).get(id) ?? { jour: 0, mois: 0, annee: 0 };

  // Historique des demandes de paiement (formule Entreprise négociée, ou toute facturation
  // manuelle émise depuis l'administration) — les plus récentes d'abord.
  const demandesPaiement = await db
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.storeId, id))
    .orderBy(desc(paymentRequests.creeLe))
    .limit(20);

  // Noms à résoudre pour l'affichage : qui a fixé le tarif négocié, qui a émis ou confirmé chaque
  // demande. Toujours des comptes de la plateforme (superadmins), jamais des employés d'une
  // boutique cliente — aucun souci de confidentialité à les nommer ici.
  const idsAResoudre = new Set<string>();
  if (boutique.tarifNegocieFixeParId) idsAResoudre.add(boutique.tarifNegocieFixeParId);
  for (const d of demandesPaiement) {
    idsAResoudre.add(d.emiseParId);
    if (d.confirmeeParId) idsAResoudre.add(d.confirmeeParId);
  }
  const noms = new Map<string, string>();
  if (idsAResoudre.size > 0) {
    const lignesNoms = await db
      .select({ id: users.id, nom: users.nom })
      .from(users)
      .where(inArray(users.id, [...idsAResoudre]));
    for (const l of lignesNoms) noms.set(l.id, l.nom);
  }

  const modules = [
    { cle: "vente", libelle: "Caisse et ventes", volume: nb("ventes_nb"),
      detail: `${nb("ventes_annulees")} annulée(s)`, dernier: quand("ventes_dernier") },
    { cle: "stock", libelle: "Stock", volume: nb("produits_nb"),
      detail: `${nb("produits_alerte")} sous le seuil`, dernier: quand("stock_dernier") },
    { cle: "clients", libelle: "Clients", volume: nb("clients_nb"),
      detail: null, dernier: quand("clients_dernier") },
    { cle: "creances", libelle: "Créances", volume: nb("credits_nb"),
      detail: `${nb("remboursements_nb")} remboursement(s)`, dernier: quand("creances_dernier") },
    { cle: "depenses", libelle: "Dépenses", volume: nb("depenses_nb"),
      detail: null, dernier: quand("depenses_dernier") },
    { cle: "documents", libelle: "Factures et proformas", volume: nb("documents_nb"),
      detail: null, dernier: quand("documents_dernier") },
    { cle: "caisse", libelle: "Comptages de caisse", volume: nb("caisse_nb"),
      detail: null, dernier: quand("caisse_dernier") },
    { cle: "employes", libelle: "Employés et appareils", volume: nb("appareils_nb"),
      detail: `${nb("invitations_utilisees")}/${nb("invitations_nb")} invitation(s) acceptée(s)`,
      dernier: quand("appareils_dernier") },
    { cle: "support", libelle: "Support", volume: nb("support_nb"),
      detail: null, dernier: quand("support_dernier") },
    { cle: "sync", libelle: "Synchronisation", volume: nb("sync_nb"),
      detail: `${nb("sync_echecs")} échec(s)`, dernier: quand("sync_dernier") },
  ];

  return NextResponse.json({
    boutique: {
      id: boutique.id,
      nom: boutique.nom,
      telephone: boutique.telephone,
      adresse: boutique.adresse,
      ville: boutique.ville,
      quartier: boutique.quartier,
      pays: boutique.pays,
      typeCommerce: boutique.typeCommerce,
      devise: boutique.devise,
      plan: boutique.plan,
      creeLe: boutique.creeLe.toISOString(),
      essaiExpireLe: boutique.essaiExpireLe?.toISOString() ?? null,
      abonnementExpireLe: boutique.abonnementExpireLe?.toISOString() ?? null,
      programmeTest: boutique.programmeTest,
      maisonMereId: boutique.maisonMereId,
      maisonMereNom: maisonMere?.nom ?? null,
      boutiquesRattachees: rattachees,
      // Tarif Entreprise négocié — jamais public (voir `src/lib/tarifs.ts`), fixé uniquement ici.
      tarifNegocieMontant: boutique.tarifNegocieMontant ? n(boutique.tarifNegocieMontant) : null,
      tarifNegocieCycle: boutique.tarifNegocieCycle,
      tarifNegocieFixeLe: boutique.tarifNegocieFixeLe?.toISOString() ?? null,
      tarifNegocieFixePar: boutique.tarifNegocieFixeParId
        ? (noms.get(boutique.tarifNegocieFixeParId) ?? null)
        : null,
    },
    modules,
    interactions,
    demandesPaiement: demandesPaiement.map((d) => ({
      id: d.id,
      plan: d.plan,
      cycle: d.cycle,
      montant: n(d.montant),
      devise: d.devise,
      periodeDebut: d.periodeDebut.toISOString(),
      periodeFin: d.periodeFin.toISOString(),
      statut: d.statut,
      creeLe: d.creeLe.toISOString(),
      emisePar: noms.get(d.emiseParId) ?? null,
      confirmeeLe: d.confirmeeLe?.toISOString() ?? null,
      confirmeeSource: d.confirmeeSource,
      confirmeePar: d.confirmeeParId ? (noms.get(d.confirmeeParId) ?? null) : null,
    })),
    // Titulaire(s) du compte — c'est l'interlocuteur commercial (facturation, support), il reste
    // identifiable. Les gérants et vendeurs ne le sont pas : voir `effectif` ci-dessous, qui ne
    // donne que des comptages.
    titulaires: titulaires.map((t) => ({
      id: t.id,
      nom: t.nom,
      email: t.email,
      telephone: t.telephone,
      superAdmin: isSuperAdminEmail(t.email),
      derniereConnexion: t.derniereConnexion?.toISOString() ?? null,
      desactive: Boolean(t.desactiveLe),
      creeLe: t.creeLe.toISOString(),
    })),
    effectif: {
      total: nb("equipe_total"),
      actifs: nb("equipe_actifs"),
      patrons: nb("equipe_patrons"),
      gerants: nb("equipe_gerants"),
      vendeurs: nb("equipe_vendeurs"),
    },
    compteurs: {
      produits: nb("produits_nb"),
      clients: nb("clients_nb"),
      ventes: nb("ventes_validees"),
      volume: n(u.volume_total as string),
      depenses: n(u.depenses_total as string),
    },
    dernieresVentes: dernieresVentes.map((v) => ({
      id: v.id,
      numero: v.numero,
      total: n(v.total),
      dateHeure: v.dateHeure.toISOString(),
      statut: v.statut,
    })),
  });
}

const patchSchema = z
  .object({
    plan: z.enum(["ESSAI", "ESSENTIEL", "PREMIUM", "ENTREPRISE"]).optional(),
    /** Nombre de jours à ajouter à l'échéance en cours (essai si plan ESSAI, abonnement sinon). */
    prolongerJours: z.number().int().min(1).max(730).optional(),
    /**
     * Tarif Entreprise négocié — les deux champs vont ensemble. Les fournir active la formule
     * Entreprise pour cette boutique et émet dans la foulée une demande de paiement (voir
     * `emettreDemandePaiement`). C'est le seul chemin qui fait passer une boutique en Entreprise :
     * voir la garde plus bas, qui refuse `plan: "ENTREPRISE"` seul, sans tarif ni tarif déjà en
     * dossier.
     */
    tarifEntrepriseMontant: z.number().positive().max(100_000_000).optional(),
    tarifEntrepriseCycle: z.enum(CYCLES as [Cycle, ...Cycle[]]).optional(),
  })
  .refine(
    (v) => (v.tarifEntrepriseMontant === undefined) === (v.tarifEntrepriseCycle === undefined),
    { message: "Le montant et la périodicité du tarif Entreprise doivent être fournis ensemble." }
  );

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const boutique = await db.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!boutique) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // Une boutique rattachée ne porte pas son contrat : son accès est gouverné par l'échéance de sa
  // maison mère (voir `src/lib/abonnement.ts`). Changer sa formule ou prolonger sa date écrirait
  // dans des colonnes que plus personne ne lit — l'administration croirait avoir agi, et la
  // boutique resterait bloquée. On refuse en désignant l'endroit où l'action a un effet.
  if (boutique.maisonMereId) {
    const mere = await db.query.stores.findFirst({
      where: eq(stores.id, boutique.maisonMereId),
      columns: { nom: true },
    });
    return NextResponse.json(
      {
        error: `Cette boutique appartient au réseau de « ${mere?.nom ?? "sa maison mère"} ». L'abonnement se modifie sur la maison mère, qui porte le contrat de tout le réseau.`,
        code: "BOUTIQUE_RATTACHEE",
      },
      { status: 409 }
    );
  }

  const fixeTarifEntreprise =
    parsed.data.tarifEntrepriseMontant !== undefined && parsed.data.tarifEntrepriseCycle !== undefined;

  // Entreprise ne s'active jamais « à vide ». Un tarif négocié doit exister — fourni dans cette
  // même requête, ou déjà en dossier depuis une négociation précédente — sinon la promesse faite
  // au propriétaire (« c'est moi qui fixe le prix ») serait contournable par le sélecteur de
  // formule générique, qui ne sait rien du prix.
  if (parsed.data.plan === "ENTREPRISE" && boutique.plan !== "ENTREPRISE" && !fixeTarifEntreprise && !boutique.tarifNegocieMontant) {
    return NextResponse.json(
      {
        error: "Fixez d'abord un tarif négocié pour activer la formule Entreprise (section « Formule Entreprise » de cette fiche).",
        code: "TARIF_ENTREPRISE_REQUIS",
      },
      { status: 400 }
    );
  }

  const planCible = fixeTarifEntreprise ? "ENTREPRISE" : (parsed.data.plan ?? boutique.plan);
  const maj: Partial<typeof stores.$inferInsert> = {};

  if (parsed.data.plan) maj.plan = parsed.data.plan;

  if (parsed.data.prolongerJours) {
    // On prolonge à partir de l'échéance en cours si elle est future, sinon à partir d'aujourd'hui :
    // prolonger un abonnement expiré depuis trois mois ne doit pas offrir ces trois mois.
    const champ = planCible === "ESSAI" ? "essaiExpireLe" : "abonnementExpireLe";
    const actuelle = planCible === "ESSAI" ? boutique.essaiExpireLe : boutique.abonnementExpireLe;
    const base = actuelle && actuelle > new Date() ? new Date(actuelle) : new Date();
    base.setDate(base.getDate() + parsed.data.prolongerJours);
    maj[champ] = base;
  }

  if (fixeTarifEntreprise) {
    // Fixer un tarif négocié active la formule dans le même geste — c'est le manque signalé par le
    // propriétaire : avant cette fonctionnalité, rien ne permettait d'activer Entreprise pour une
    // boutique qui la demandait.
    maj.plan = "ENTREPRISE";
    maj.tarifNegocieMontant = String(parsed.data.tarifEntrepriseMontant!);
    maj.tarifNegocieCycle = parsed.data.tarifEntrepriseCycle!;
    maj.tarifNegocieFixeLe = new Date();
    maj.tarifNegocieFixeParId = session.userId;
  }

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const [maj_] = await db.update(stores).set(maj).where(eq(stores.id, id)).returning();

  // La demande de paiement est émise après coup, à partir de l'échéance *avant* cette écriture :
  // si `prolongerJours` était aussi passé dans le même appel (l'écran ne le fait jamais, mais
  // l'API ne l'interdit pas), la période facturée reste celle annoncée au moment de fixer le prix,
  // pas une échéance déjà avancée par l'autre champ du même PATCH.
  const demandePaiement = fixeTarifEntreprise
    ? await emettreDemandePaiement({
        storeId: id,
        plan: "ENTREPRISE",
        cycle: parsed.data.tarifEntrepriseCycle!,
        montant: parsed.data.tarifEntrepriseMontant!,
        devise: boutique.devise,
        abonnementExpireLe: boutique.abonnementExpireLe,
        emiseParId: session.userId,
      })
    : null;

  return NextResponse.json({
    ok: true,
    boutique: {
      id: maj_.id,
      nom: maj_.nom,
      plan: maj_.plan,
      essaiExpireLe: maj_.essaiExpireLe?.toISOString() ?? null,
      abonnementExpireLe: maj_.abonnementExpireLe?.toISOString() ?? null,
      tarifNegocieMontant: maj_.tarifNegocieMontant ? n(maj_.tarifNegocieMontant) : null,
      tarifNegocieCycle: maj_.tarifNegocieCycle,
      tarifNegocieFixeLe: maj_.tarifNegocieFixeLe?.toISOString() ?? null,
    },
    demandePaiement: demandePaiement
      ? {
          id: demandePaiement.id,
          montant: n(demandePaiement.montant),
          devise: demandePaiement.devise,
          periodeDebut: demandePaiement.periodeDebut.toISOString(),
          periodeFin: demandePaiement.periodeFin.toISOString(),
          statut: demandePaiement.statut,
        }
      : null,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const boutique = await db.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!boutique) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  // Se supprimer soi-même depuis l'écran d'administration serait une fausse manœuvre coûteuse.
  if (boutique.id === session.storeId) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre boutique depuis l'administration." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || body.confirmation !== boutique.nom) {
    return NextResponse.json(
      { error: `Saisissez exactement le nom de la boutique pour confirmer : ${boutique.nom}` },
      { status: 400 }
    );
  }

  await db.delete(stores).where(eq(stores.id, id));
  return NextResponse.json({ ok: true });
}
