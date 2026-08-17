// Superadmin — fiche d'une boutique et actions d'administration.
//
// GET    : détail, équipe et activité.
// PATCH  : changer le plan, fixer ou prolonger une échéance (essai ou abonnement).
// DELETE : supprimer la boutique et toutes ses données. Protégé par la saisie exacte du nom, comme
//          la suppression par le Patron lui-même — un clic de trop ne doit pas effacer le commerce
//          de quelqu'un.

import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { clients, expenses, products, sales, stores, users } from "@/db/schema";
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

  const [equipe, compteurs, dernieresVentes] = await Promise.all([
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
    Promise.all([
      db.select({ nb: sql<number>`count(*)::int` }).from(products).where(eq(products.storeId, id)),
      db.select({ nb: sql<number>`count(*)::int` }).from(clients).where(eq(clients.storeId, id)),
      db
        .select({
          nb: sql<number>`count(*)::int`,
          volume: sql<string>`coalesce(sum(${sales.total}), 0)`,
        })
        .from(sales)
        .where(and(eq(sales.storeId, id), eq(sales.statut, "VALIDEE"))),
      db
        .select({ montant: sql<string>`coalesce(sum(${expenses.montant}), 0)` })
        .from(expenses)
        .where(eq(expenses.storeId, id)),
    ]),
    db
      .select({ id: sales.id, numero: sales.numero, total: sales.total, dateHeure: sales.dateHeure, statut: sales.statut })
      .from(sales)
      .where(eq(sales.storeId, id))
      .orderBy(desc(sales.dateHeure))
      .limit(10),
  ]);

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
    },
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
      produits: compteurs[0][0]?.nb ?? 0,
      clients: compteurs[1][0]?.nb ?? 0,
      ventes: compteurs[2][0]?.nb ?? 0,
      volume: n(compteurs[2][0]?.volume),
      depenses: n(compteurs[3][0]?.montant),
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
