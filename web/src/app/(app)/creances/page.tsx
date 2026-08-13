import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { CreancesView } from "@/components/creances/creances-view";

export default async function CreancesPage() {
  const session = await getSession();
  if (!session || !can(session.role, "creances.view")) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas accès à ce module.</p>
      </div>
    );
  }

  const canEdit = can(session.role, "creances.edit");

  return (
    <div className="space-y-4 p-4 pb-20 md:p-6 md:pb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Créances</h1>
        <p className="text-sm text-muted-foreground">
          Clients débiteurs, relances et remboursements des ventes à crédit.
        </p>
      </div>
      <CreancesView canEdit={canEdit} />
    </div>
  );
}
