import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ClientsView } from "@/components/clients/clients-view";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session || !can(session.role, "clients.view")) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas accès à ce module.</p>
      </div>
    );
  }

  const canEdit = can(session.role, "clients.edit");

  return (
    <div className="space-y-4 p-4 pb-20 md:p-6 md:pb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Vos clients fidèles et récurrents : historique d&apos;achats, habitudes et relances.
        </p>
      </div>
      <ClientsView canEdit={canEdit} />
    </div>
  );
}
