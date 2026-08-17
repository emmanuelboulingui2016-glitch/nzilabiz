import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const [store, reglages] = await Promise.all([
    db.query.stores.findFirst({ where: eq(stores.id, session.storeId) }),
    getPlatformSettings(),
  ]);

  return (
    <AppShell
      role={session.role}
      userName={session.nom}
      storeName={store?.nom ?? "NzilaBiz"}
      superAdmin={isSuperAdminEmail(session.email)}
      annonce={reglages.annonceActive ? reglages.annonce : null}
    >
      {children}
    </AppShell>
  );
}
