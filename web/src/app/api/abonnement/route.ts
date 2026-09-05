// Demande de paiement en attente pour la boutique de la session — lecture seule.
//
// Le commerçant ne peut ni fixer ni confirmer un paiement : c'est le propriétaire de la plateforme
// qui négocie le tarif Entreprise et confirme la réception (voir `src/app/api/superadmin/**`). Ce
// commerçant voit seulement ce qu'il doit, pour quelle période, et comment payer en attendant
// qu'un agrégateur Mobile Money soit branché.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { paymentRequests } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isNaN(x) ? 0 : x;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // La plus récente demande encore en attente : une demande payée, expirée ou annulée n'a plus
  // rien à dire au commerçant.
  const demande = await db.query.paymentRequests.findFirst({
    where: and(eq(paymentRequests.storeId, session.storeId), eq(paymentRequests.statut, "EN_ATTENTE")),
    orderBy: (p, { desc: d }) => [d(p.creeLe)],
  });

  return NextResponse.json({
    demande: demande
      ? {
          id: demande.id,
          plan: demande.plan,
          cycle: demande.cycle,
          montant: n(demande.montant),
          devise: demande.devise,
          periodeDebut: demande.periodeDebut.toISOString(),
          periodeFin: demande.periodeFin.toISOString(),
          creeLe: demande.creeLe.toISOString(),
        }
      : null,
  });
}
