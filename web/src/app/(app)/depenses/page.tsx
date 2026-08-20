import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chargerDepenses } from "@/components/depenses/get-depenses-data";
import { DepensesClient } from "@/components/depenses/depenses-client";

export default async function DepensesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "depenses.view")) redirect("/dashboard");

  const canEdit = can(session.role, "depenses.edit");

  // Affichage immédiat de ce qui existe. L'appel à l'API qui suit déclenche en plus la génération
  // des dépenses récurrentes échues — une écriture, qui n'a donc pas sa place dans le rendu.
  // `generatedRecurringCount` vaut zéro ici : le rendu ne génère rien, c'est l'appel à l'API qui
  // s'en charge et qui affichera l'avis le cas échéant.
  const initial = { ...(await chargerDepenses(session.storeId, { periode: "mois" })), generatedRecurringCount: 0 };

  return (
    <div className="pb-20 md:pb-0">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Dépenses</h1>
        <p className="text-sm text-muted-foreground">
          Suivez les rachats de stock et les autres charges de la boutique.
        </p>
      </div>
      <DepensesClient initial={initial} canEdit={canEdit} />
    </div>
  );
}
