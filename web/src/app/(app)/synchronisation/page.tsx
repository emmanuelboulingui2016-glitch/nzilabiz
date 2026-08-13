import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getSyncStatus, getDevices } from "@/components/synchronisation/queries";
import { SyncDashboard } from "@/components/synchronisation/sync-dashboard";

export default async function SynchronisationPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "synchronisation.view")) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à cette page.
      </div>
    );
  }

  const [status, devices] = await Promise.all([
    getSyncStatus(session.storeId),
    getDevices(session.storeId),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Synchronisation</h1>
      <SyncDashboard
        initialStatus={status}
        initialDevices={devices}
        currentDeviceId={session.deviceId ?? null}
      />
    </div>
  );
}
