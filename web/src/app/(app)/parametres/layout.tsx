import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/rbac";

const TABS: { href: string; label: string; permission: Permission }[] = [
  { href: "/parametres/boutique", label: "Boutique", permission: "parametres.boutique" },
  { href: "/parametres/abonnement", label: "Abonnement", permission: "parametres.abonnement" },
  { href: "/parametres/facturation", label: "Facturation", permission: "parametres.boutique" },
  { href: "/parametres/devise", label: "Devise", permission: "parametres.devise" },
  { href: "/parametres/utilisateurs", label: "Utilisateurs", permission: "parametres.utilisateurs" },
  { href: "/parametres/securite", label: "Sécurité & connexion", permission: "parametres.securite" },
  { href: "/parametres/notifications", label: "Notifications", permission: "parametres.notifications" },
  { href: "/parametres/mobile-money", label: "Mobile Money", permission: "parametres.mobilemoney" },
  { href: "/parametres/synchronisation", label: "Synchronisation", permission: "parametres.synchronisation" },
];

export default async function ParametresLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const visibleTabs = TABS.filter((tab) => can(session.role, tab.permission));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Paramètres</h1>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div>{children}</div>
    </div>
  );
}
