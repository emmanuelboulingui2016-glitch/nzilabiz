import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chargerStock } from "@/components/stock/get-stock-data";
import { StockPageClient } from "@/components/stock/stock-page-client";

// Les données partent avec la page. La version précédente n'envoyait qu'une coquille vide, que le
// navigateur devait aussitôt re-remplir par un appel à l'API : deux allers-retours avant le premier
// produit affiché, soit près de sept dixièmes de seconde d'attente supplémentaire sur une connexion
// gabonaise, pour des données que le serveur avait déjà sous la main.
export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "stock.view")) redirect("/dashboard");

  const initial = await chargerStock(session.storeId);

  return (
    <StockPageClient
      initial={initial}
      canEdit={can(session.role, "stock.edit")}
      canAdjust={can(session.role, "stock.ajustement")}
    />
  );
}
