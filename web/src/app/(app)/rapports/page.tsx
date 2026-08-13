import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getRapportsData } from "@/components/rapports/get-rapports-data";
import { RapportsClient } from "@/components/rapports/rapports-client";

export default async function RapportsPage() {
  const session = await getSession();
  if (!session) return null; // le layout (app) redirige déjà vers /connexion.

  if (!can(session.role, "rapports.view")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Vous n&apos;avez pas accès aux rapports.
      </div>
    );
  }

  const [store, initialData] = await Promise.all([
    db.query.stores.findFirst({ where: eq(stores.id, session.storeId), columns: { nom: true } }),
    getRapportsData(session.storeId, "month"),
  ]);

  return <RapportsClient storeName={store?.nom ?? "NzilaBiz"} initialData={initialData} />;
}
