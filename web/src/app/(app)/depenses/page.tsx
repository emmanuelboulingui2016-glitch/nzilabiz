import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { DepensesClient } from "@/components/depenses/depenses-client";

export default async function DepensesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "depenses.view")) redirect("/dashboard");

  const canEdit = can(session.role, "depenses.edit");

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Dépenses</h1>
        <p className="text-sm text-muted-foreground">
          Suivez les rachats de stock et les autres charges de la boutique.
        </p>
      </div>
      <DepensesClient canEdit={canEdit} />
    </div>
  );
}
