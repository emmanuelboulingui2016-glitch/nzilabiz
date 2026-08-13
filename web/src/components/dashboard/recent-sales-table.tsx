import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/currency";
import type { RecentSaleRow } from "./types";

const PAIEMENT_TONE: Record<string, "success" | "info" | "warning" | "neutral"> = {
  Espèces: "success",
  "Mobile Money": "info",
  Crédit: "warning",
  Mixte: "neutral",
};

export function RecentSalesTable({ sales }: { sales: RecentSaleRow[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-foreground">Ventes récentes</CardTitle>
        <Link href="/ventes" className="text-xs font-medium text-primary hover:underline">
          Voir toutes
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {sales.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aucune vente aujourd&apos;hui pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Heure</th>
                  <th className="px-4 py-2 font-medium">Article</th>
                  <th className="px-4 py-2 font-medium text-right">Qté</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{sale.heure}</td>
                    <td className="px-4 py-2">{sale.article}</td>
                    <td className="px-4 py-2 text-right">{sale.qte}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatFcfa(sale.total)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={PAIEMENT_TONE[sale.paiement] ?? "neutral"}>{sale.paiement}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
