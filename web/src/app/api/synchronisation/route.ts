import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getSyncStatus } from "@/components/synchronisation/queries";

// GET /api/synchronisation — résumé de statut : dernière synchronisation, échecs, journal.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "synchronisation.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const status = await getSyncStatus(session.storeId);
  return NextResponse.json(status);
}
