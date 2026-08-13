import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { VendreScreen } from "@/components/vendre/vendre-screen";

export default async function VendrePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  if (!can(session.role, "vendre.use")) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas accès à l&apos;écran de vente.</p>
      </div>
    );
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });

  return <VendreScreen storeId={session.storeId} userId={session.userId} storeName={store?.nom ?? "NzilaBiz"} />;
}
