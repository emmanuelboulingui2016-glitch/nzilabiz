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

  // Enchaînées, jamais en parallèle : le pooler en mode transaction ne rend pas la main quand
  // plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  // Seul le nom est lu : la ligne complète embarque `logo_url`, une image entière en base64, et
  // ce calque s'exécute au-dessus de chaque page de l'application.
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });
  const reglages = await getPlatformSettings();

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
