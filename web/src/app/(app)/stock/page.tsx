import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { StockPageClient } from "@/components/stock/stock-page-client";

export default async function StockPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "stock.view")) redirect("/dashboard");

  return (
    <StockPageClient
      canEdit={can(session.role, "stock.edit")}
      canAdjust={can(session.role, "stock.ajustement")}
    />
  );
}
