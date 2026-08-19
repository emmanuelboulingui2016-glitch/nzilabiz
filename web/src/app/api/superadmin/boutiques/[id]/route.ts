// Superadmin — fiche d'une boutique et actions d'administration.
//
// GET    : détail, équipe et activité.
// PATCH  : changer le plan, fixer ou prolonger une échéance (essai ou abonnement).
// DELETE : supprimer la boutique et toutes ses données. Protégé par la saisie exacte du nom, comme
//          la suppression par le Patron lui-même — un clic de trop ne doit pas effacer le commerce
//          de quelqu'un.

import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { sales, stores, users } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";

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

  const [equipe, dernieresVentes] = await Promise.all([
    db
      .select({
        id: users.id,
        nom: users.nom,
        email: users.email,
        role: users.role,
        derniereConnexion: users.derniereConnexion,
        desactiveLe: users.desactiveLe,
        creeLe: users.creeLe,
      })
      .from(users)
      .where(eq(users.storeId, id))
      .orderBy(users.role),
    db
      .select({ id: sales.id, numero: sales.numero, total: sales.total, dateHeure: sales.dateHeure, statut: sales.statut })
      .from(sales)
      .where(eq(sales.storeId, id))
      .orderBy(desc(sales.dateHeure))
      .limit(10),
  ]);

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
      (select max(horodatage) from sync_logs where store_id = ${id})                         as sync_dernier
  `);

  const u = (usage ?? {}) as Record<string, unknown>;
  const nb = (k: string) => Number(u[k] ?? 0);
  const quand = (k: string) => (u[k] ? new Date(u[k] as string).toISOString() : null);

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
    },
    modules,
    equipe: equipe.map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      role: u.role,
      superAdmin: isSuperAdminEmail(u.email),
      derniereConnexion: u.derniereConnexion?.toISOString() ?? null,
      desactive: Boolean(u.desactiveLe),
      creeLe: u.creeLe.toISOString(),
    })),
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

const patchSchema = z.object({
  plan: z.enum(["ESSAI", "PREMIUM", "ENTREPRISE"]).optional(),
  /** Nombre de jours à ajouter à l'échéance en cours (essai si plan ESSAI, abonnement sinon). */
  prolongerJours: z.number().int().min(1).max(730).optional(),
});

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

  const planCible = parsed.data.plan ?? boutique.plan;
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

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const [maj_] = await db.update(stores).set(maj).where(eq(stores.id, id)).returning();

  return NextResponse.json({
    ok: true,
    boutique: {
      id: maj_.id,
      nom: maj_.nom,
      plan: maj_.plan,
      essaiExpireLe: maj_.essaiExpireLe?.toISOString() ?? null,
      abonnementExpireLe: maj_.abonnementExpireLe?.toISOString() ?? null,
    },
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
