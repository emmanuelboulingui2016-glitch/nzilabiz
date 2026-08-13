import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LowStockRow } from "./types";

export function LowStockWidget({ items }: { items: LowStockRow[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <AlertTriangle size={16} className="text-warning" />
          Alertes stock
        </CardTitle>
        <Link href="/stock" className="text-xs font-medium text-primary hover:underline">
          Voir tout
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte — tous les stocks sont au-dessus du seuil.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.nom}</span>
                <Badge tone={item.quantiteStock === 0 ? "danger" : "warning"}>
                  {item.quantiteStock === 0 ? "Rupture" : `${item.quantiteStock} ${item.unite}`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
