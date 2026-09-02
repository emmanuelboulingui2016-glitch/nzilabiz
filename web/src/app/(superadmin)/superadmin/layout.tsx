import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getSuperAdminSession, superAdminEmails } from "@/lib/auth/superadmin";
import { AdminMobileNav, AdminSidebar } from "@/components/superadmin/admin-sidebar";

// Administration de la plateforme — hors de l'application boutique : pas de navigation métier, pas
// de storeId. L'accès est vérifié ici, à chaque rendu, et à nouveau dans chaque route d'API.
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const superAdmin = await getSuperAdminSession();
  if (!superAdmin) {
    const aucunConfigure = superAdminEmails().length === 0;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-bold">Espace réservé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette section est réservée à l&apos;administration de la plateforme.
          </p>
          {aucunConfigure ? (
            <p className="mt-3 rounded-lg bg-warning/10 p-3 text-left text-xs text-warning">
              Aucun superadmin n&apos;est configuré. Ajoutez{" "}
              <code className="font-mono">SUPERADMIN_EMAILS=&quot;{session.email}&quot;</code> dans le
              fichier <code className="font-mono">web/.env</code> puis redémarrez le serveur.
            </p>
          ) : null}
          <Link
            href="/dashboard"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            Retour à ma boutique
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Un administrateur de plateforme est identifié par son adresse : `getSuperAdminSession`
          l'a déjà comparée à la liste autorisée, elle ne peut pas être absente ici. */}
      <AdminSidebar email={superAdmin.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
