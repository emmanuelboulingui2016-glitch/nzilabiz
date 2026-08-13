import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDevices } from "@/components/synchronisation/queries";
import { ConflictRules } from "@/components/synchronisation/conflict-rules";
import { DeviceManager } from "@/components/synchronisation/device-manager";

export default async function ParametresSynchronisationPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.synchronisation")) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à cette page.
      </div>
    );
  }

  const devices = await getDevices(session.storeId);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <ConflictRules />
      <DeviceManager initialDevices={devices} currentDeviceId={session.deviceId ?? null} />
    </div>
  );
}
