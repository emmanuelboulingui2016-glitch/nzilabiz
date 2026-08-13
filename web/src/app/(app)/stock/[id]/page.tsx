import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ProductDetailClient } from "@/components/stock/product-detail-client";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "stock.view")) redirect("/dashboard");

  const { id } = await params;

  return (
    <ProductDetailClient
      productId={id}
      canEdit={can(session.role, "stock.edit")}
      canAdjust={can(session.role, "stock.ajustement")}
    />
  );
}
