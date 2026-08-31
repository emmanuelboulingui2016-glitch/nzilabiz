import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { cashCounts } from "@/db/schema";
import { getDashboardData } from "@/components/dashboard/get-dashboard-data";
import { bloquerSiExpiree } from "@/lib/abonnement";

// POST /api/dashboard/cash-count — §5 🔧 fond de caisse d'ouverture / comptage de fermeture.
// body: { type: "OUVERTURE" | "FERMETURE", montantSaisi: number }
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "dashboard.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const montantSaisi = Number(body?.montantSaisi);

  if ((type !== "OUVERTURE" && type !== "FERMETURE") || Number.isNaN(montantSaisi) || montantSaisi < 0) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (type === "OUVERTURE") {
    const [created] = await db
      .insert(cashCounts)
      .values({
        storeId: session.storeId,
        userId: session.userId,
        type: "OUVERTURE",
        montantSaisi: String(montantSaisi),
      })
      .returning();
    return NextResponse.json({ ok: true, cashCount: created });
  }

  // FERMETURE : le solde théorique est le "Reste en caisse" calculé au moment du comptage.
  const data = await getDashboardData(session.storeId);
  const montantTheorique = data.caisse.resteEnCaisse;
  const ecart = montantSaisi - montantTheorique;

  const [created] = await db
    .insert(cashCounts)
    .values({
      storeId: session.storeId,
      userId: session.userId,
      type: "FERMETURE",
      montantSaisi: String(montantSaisi),
      montantTheorique: String(montantTheorique),
      ecart: String(ecart),
    })
    .returning();

  return NextResponse.json({ ok: true, cashCount: created });
}
