import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { notificationSettings } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";

// Onglet Notifications — §14 du cahier des charges : seuils d'alerte + interrupteurs par type
// d'alerte, sur la table `notificationSettings` (une ligne par boutique, créée normalement à
// l'inscription — on la crée défensivement ici si absente).

const notificationsSchema = z.object({
  creanceRetardJours: z.coerce.number().int().min(0).max(365),
  grosseDepenseSeuil: z.coerce.number().min(0),
  peremptionAlerteJours: z.coerce.number().int().min(0).max(365),
  alerteStockBas: z.boolean(),
  alertePeremption: z.boolean(),
  alerteCreanceRetard: z.boolean(),
  alerteVenteRealisee: z.boolean(),
  alerteGrosseDepense: z.boolean(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.notifications")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let settings = await db.query.notificationSettings.findFirst({
    where: eq(notificationSettings.storeId, session.storeId),
  });

  if (!settings) {
    // Défensif : normalement créé à l'inscription (voir /api/auth/register), mais on ne veut
    // pas planter l'écran si la ligne manque pour une boutique plus ancienne.
    const [created] = await db
      .insert(notificationSettings)
      .values({ storeId: session.storeId })
      .returning();
    settings = created;
  }

  return NextResponse.json({
    creanceRetardJours: settings.creanceRetardJours,
    grosseDepenseSeuil: Number(settings.grosseDepenseSeuil),
    peremptionAlerteJours: settings.peremptionAlerteJours,
    alerteStockBas: settings.alerteStockBas,
    alertePeremption: settings.alertePeremption,
    alerteCreanceRetard: settings.alerteCreanceRetard,
    alerteVenteRealisee: settings.alerteVenteRealisee,
    alerteGrosseDepense: settings.alerteGrosseDepense,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.notifications")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = notificationsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await db.query.notificationSettings.findFirst({
    where: eq(notificationSettings.storeId, session.storeId),
  });

  const values = {
    creanceRetardJours: data.creanceRetardJours,
    grosseDepenseSeuil: String(data.grosseDepenseSeuil),
    peremptionAlerteJours: data.peremptionAlerteJours,
    alerteStockBas: data.alerteStockBas,
    alertePeremption: data.alertePeremption,
    alerteCreanceRetard: data.alerteCreanceRetard,
    alerteVenteRealisee: data.alerteVenteRealisee,
    alerteGrosseDepense: data.alerteGrosseDepense,
  };

  const updated = existing
    ? (
        await db
          .update(notificationSettings)
          .set(values)
          .where(eq(notificationSettings.storeId, session.storeId))
          .returning()
      )[0]
    : (
        await db
          .insert(notificationSettings)
          .values({ storeId: session.storeId, ...values })
          .returning()
      )[0];

  return NextResponse.json({ ok: true, settings: updated });
}
