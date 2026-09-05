// Créances — §9 du cahier des charges.
// GET  : liste des clients de la boutique avec solde créance calculé + jours de retard.
// POST : création d'un client (avec limite de crédit / échéance personnalisées — amélioration).
//
// La règle de calcul du solde et du retard vit dans lib/creances/solde.ts (partagée avec le
// centre de notifications).

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { chargerCreances } from "@/lib/creances/solde";
import { bloquerSiExpiree } from "@/lib/abonnement";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(session, "creances.view"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Le calcul vit dans lib/creances/solde.ts : le centre de notifications s'appuie sur la même
  // fonction, pour que les deux écrans ne puissent pas diverger.
  const result = await chargerCreances(session.storeId);
  return NextResponse.json({ clients: result });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "creances.edit"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.nom !== "string" || !body.nom.trim()) {
    return NextResponse.json({ error: "Le nom du client est requis" }, { status: 400 });
  }

  const [created] = await db
    .insert(clients)
    .values({
      storeId: session.storeId,
      nom: body.nom.trim(),
      telephone: typeof body.telephone === "string" && body.telephone.trim() ? body.telephone.trim() : null,
      limiteCredit:
        body.limiteCredit !== undefined && body.limiteCredit !== null && body.limiteCredit !== ""
          ? String(body.limiteCredit)
          : null,
      echeanceJours:
        body.echeanceJours !== undefined && body.echeanceJours !== null && body.echeanceJours !== ""
          ? Number(body.echeanceJours)
          : null,
    })
    .returning();

  return NextResponse.json({ client: created }, { status: 201 });
}
