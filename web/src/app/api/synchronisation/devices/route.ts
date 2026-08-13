import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDevices } from "@/components/synchronisation/queries";

// GET /api/synchronisation/devices — liste des appareils enregistrés pour la boutique
// (utilisée par /synchronisation et par Paramètres > Synchronisation — voir NOTE sur l'overlap
// avec Paramètres > Sécurité dans le résumé de tâche : cette route est la seule source de vérité
// pour la liste des appareils, Paramètres > Sécurité se contente d'un lien vers /synchronisation).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "synchronisation.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const list = await getDevices(session.storeId);
  return NextResponse.json({ devices: list, currentDeviceId: session.deviceId ?? null });
}
