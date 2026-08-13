import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });

  return (
    <AppShell role={session.role} userName={session.nom} storeName={store?.nom ?? "NzilaBiz"}>
      {children}
    </AppShell>
  );
}
