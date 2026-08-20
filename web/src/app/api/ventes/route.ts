// GET /api/ventes — historique des ventes (§7 du cahier des charges).
// Filtres : période (from/to), mode de paiement, recherche article. Scoping strict par storeId,
// et par ventes.view.own (Vendeur ne voit que ses propres ventes) vs ventes.view.all (Patron/Gérant).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chargerVentes } from "@/components/ventes/get-ventes-data";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const canViewAll = can(session.role, "ventes.view.all");
  const canViewOwn = can(session.role, "ventes.view.own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  return NextResponse.json(
    await chargerVentes(
      { storeId: session.storeId, userId: session.userId, canViewAll },
      {
        from: searchParams.get("from"),
        to: searchParams.get("to"),
        paiement: searchParams.get("paiement"),
        q: searchParams.get("q"),
      }
    )
  );
}
