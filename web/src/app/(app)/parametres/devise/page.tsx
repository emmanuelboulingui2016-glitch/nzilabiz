import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { DeviseForm } from "@/components/parametres/devise/devise-form";

export default async function DevisePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.devise")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) redirect("/connexion");

  return (
    <DeviseForm
      initialDevise={store.devise}
      initialTauxChange={store.tauxChangeManuel !== null ? Number(store.tauxChangeManuel) : null}
    />
  );
}
