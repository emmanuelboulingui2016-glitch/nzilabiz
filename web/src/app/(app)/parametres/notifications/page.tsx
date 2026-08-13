import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { notificationSettings } from "@/db/schema";
import { NotificationsForm } from "@/components/parametres/notifications/notifications-form";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.notifications")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  let settings = await db.query.notificationSettings.findFirst({
    where: eq(notificationSettings.storeId, session.storeId),
  });

  // Défensif : normalement créé à l'inscription (voir /api/auth/register).
  if (!settings) {
    const [created] = await db
      .insert(notificationSettings)
      .values({ storeId: session.storeId })
      .returning();
    settings = created;
  }

  return (
    <NotificationsForm
      initial={{
        creanceRetardJours: settings.creanceRetardJours,
        grosseDepenseSeuil: Number(settings.grosseDepenseSeuil),
        peremptionAlerteJours: settings.peremptionAlerteJours,
        alerteStockBas: settings.alerteStockBas,
        alertePeremption: settings.alertePeremption,
        alerteCreanceRetard: settings.alerteCreanceRetard,
        alerteVenteRealisee: settings.alerteVenteRealisee,
        alerteGrosseDepense: settings.alerteGrosseDepense,
      }}
    />
  );
}
