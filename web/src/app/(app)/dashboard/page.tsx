import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, TrendingUp, ShoppingCart, HandCoins, Receipt } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import { getDashboardData } from "@/components/dashboard/get-dashboard-data";
import { CashCountOpeningBanner } from "@/components/dashboard/cash-count-opening";
import { CashCountClosingWidget } from "@/components/dashboard/cash-count-closing";
import { EncaisseBlock } from "@/components/dashboard/encaisse-block";
import { WeeklySalesChart } from "@/components/dashboard/weekly-sales-chart";
import { LowStockWidget } from "@/components/dashboard/low-stock-widget";
import { TopProductsWidget } from "@/components/dashboard/top-products-widget";
import { RecentSalesTable } from "@/components/dashboard/recent-sales-table";

function deltaLabel(pct: number | null): string | undefined {
  if (pct === null) return undefined;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs hier`;
}

function deltaTone(pct: number | null): "positive" | "negative" | "neutral" {
  if (pct === null || pct === 0) return "neutral";
  return pct > 0 ? "positive" : "negative";
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "dashboard.view")) redirect("/vendre");

  const data = await getDashboardData(session.storeId);
  const { kpi, encaisse, caisse, weeklySales, lowStock, topProducts, recentSales } = data;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Aperçu de l&apos;activité de votre boutique aujourd&apos;hui.</p>
        </div>
        <Link
          href="/vendre"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          <Plus size={16} />
          Nouvelle vente
        </Link>
      </div>

      {caisse.ouvertureManquante && <CashCountOpeningBanner />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CA du jour"
          value={formatFcfa(kpi.caDuJour)}
          delta={deltaLabel(kpi.caDeltaPct)}
          deltaTone={deltaTone(kpi.caDeltaPct)}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="Ventes aujourd'hui"
          value={kpi.ventesDuJour}
          delta={deltaLabel(kpi.ventesDeltaPct)}
          deltaTone={deltaTone(kpi.ventesDeltaPct)}
          icon={<ShoppingCart size={18} />}
        />
        <StatCard
          label="Créances en cours"
          value={formatFcfa(kpi.creancesEnCours)}
          icon={<HandCoins size={18} />}
          helpText="Total des ventes à crédit non encore réglées par les clients"
        />
        <StatCard
          label="Dépenses du jour"
          value={formatFcfa(kpi.depensesDuJour)}
          icon={<Receipt size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <EncaisseBlock encaisse={encaisse} caisse={caisse} />
          <CashCountClosingWidget resteEnCaisse={caisse.resteEnCaisse} cashCountFermeture={caisse.cashCountFermeture} />
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="space-y-0">
              <CardTitle className="text-foreground">Ventes de la semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklySalesChart data={weeklySales} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <LowStockWidget items={lowStock} />
        <TopProductsWidget items={topProducts} />
      </div>

      <RecentSalesTable sales={recentSales} />
    </div>
  );
}
