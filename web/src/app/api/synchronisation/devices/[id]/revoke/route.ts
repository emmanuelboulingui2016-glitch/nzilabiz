import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { devices } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDeviceForStore } from "@/components/synchronisation/queries";

// POST /api/synchronisation/devices/[id]/revoke — révoque l'accès d'un appareil de la boutique
// (perdu, volé, ou ancien employé — §11 et §14 du cahier des charges).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "synchronisation.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const device = await getDeviceForStore(session.storeId, id);
  if (!device) {
    return NextResponse.json({ error: "Appareil introuvable" }, { status: 404 });
  }

  if (session.deviceId && device.id === session.deviceId) {
    return NextResponse.json(
      { error: "Impossible de révoquer l'appareil que vous utilisez actuellement." },
      { status: 400 }
    );
  }

  if (device.revoque) {
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  await db.update(devices).set({ revoque: true }).where(eq(devices.id, id));

  return NextResponse.json({ ok: true });
}
