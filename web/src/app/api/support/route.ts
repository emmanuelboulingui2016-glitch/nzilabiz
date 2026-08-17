// Support côté commerçant : envoyer une demande, consulter ses demandes et les réponses.
//
// Accessible à tous les rôles : un vendeur qui bute sur la caisse doit pouvoir demander de l'aide
// sans passer par son patron.

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { supportTickets } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  sujet: z.string().trim().min(3, "Le sujet est trop court.").max(160),
  message: z.string().trim().min(10, "Décrivez votre problème en quelques phrases.").max(4000),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.storeId, session.storeId))
    .orderBy(desc(supportTickets.creeLe))
    .limit(50);

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      sujet: t.sujet,
      message: t.message,
      statut: t.statut,
      reponse: t.reponse,
      reponduLe: t.reponduLe?.toISOString() ?? null,
      auteurNom: t.auteurNom,
      creeLe: t.creeLe.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Un formulaire ouvert à tous mérite une limite : 5 demandes par heure et par compte.
  const limite = await rateLimit(`support:${session.userId}:${clientIp(request)}`, {
    limite: 5,
    fenetreMs: 60 * 60_000,
    blocageMs: 60 * 60_000,
  });
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de demandes envoyées. Réessayez dans une heure.");
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      storeId: session.storeId,
      userId: session.userId,
      auteurNom: session.nom,
      auteurEmail: session.email,
      sujet: parsed.data.sujet,
      message: parsed.data.message,
    })
    .returning();

  return NextResponse.json({ ok: true, ticket: { id: ticket.id, creeLe: ticket.creeLe.toISOString() } }, { status: 201 });
}
