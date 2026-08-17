// Superadmin — traitement des demandes d'assistance.
//
// GET   : toutes les demandes, avec la boutique d'origine, filtrables par statut.
// PATCH : répondre et/ou changer le statut d'une demande.

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores, supportTickets } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";

export async function GET(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const statut = new URL(request.url).searchParams.get("statut");

  const lignes = await db
    .select({
      id: supportTickets.id,
      sujet: supportTickets.sujet,
      message: supportTickets.message,
      statut: supportTickets.statut,
      reponse: supportTickets.reponse,
      reponduParEmail: supportTickets.reponduParEmail,
      reponduLe: supportTickets.reponduLe,
      auteurNom: supportTickets.auteurNom,
      auteurEmail: supportTickets.auteurEmail,
      creeLe: supportTickets.creeLe,
      storeId: stores.id,
      storeNom: stores.nom,
      storePlan: stores.plan,
    })
    .from(supportTickets)
    .innerJoin(stores, eq(stores.id, supportTickets.storeId))
    .where(
      statut && statut !== "TOUS"
        ? eq(supportTickets.statut, statut as "OUVERT" | "EN_COURS" | "RESOLU" | "FERME")
        : undefined
    )
    .orderBy(desc(supportTickets.creeLe))
    .limit(200);

  return NextResponse.json({
    tickets: lignes.map((t) => ({
      id: t.id,
      sujet: t.sujet,
      message: t.message,
      statut: t.statut,
      reponse: t.reponse,
      reponduParEmail: t.reponduParEmail,
      reponduLe: t.reponduLe?.toISOString() ?? null,
      auteur: { nom: t.auteurNom, email: t.auteurEmail },
      boutique: { id: t.storeId, nom: t.storeNom, plan: t.storePlan },
      creeLe: t.creeLe.toISOString(),
    })),
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  reponse: z.string().trim().max(4000).nullable().optional(),
  statut: z.enum(["OUVERT", "EN_COURS", "RESOLU", "FERME"]).optional(),
});

export async function PATCH(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const existant = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, parsed.data.id),
  });
  if (!existant) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const maj: Partial<typeof supportTickets.$inferInsert> = {};
  if (parsed.data.statut) maj.statut = parsed.data.statut;
  if (parsed.data.reponse !== undefined) {
    const texte = parsed.data.reponse?.trim() || null;
    maj.reponse = texte;
    maj.reponduParEmail = texte ? session.email : null;
    maj.reponduLe = texte ? new Date() : null;
    // Répondre fait passer la demande en cours de traitement si elle était encore ouverte.
    if (texte && !parsed.data.statut && existant.statut === "OUVERT") maj.statut = "EN_COURS";
  }

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const [ticket] = await db
    .update(supportTickets)
    .set(maj)
    .where(eq(supportTickets.id, parsed.data.id))
    .returning();

  return NextResponse.json({ ok: true, ticket: { id: ticket.id, statut: ticket.statut } });
}
