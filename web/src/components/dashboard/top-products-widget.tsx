import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import type { TopProductRow } from "./types";

// §5 Mini-widget "Top produits du jour"
export function TopProductsWidget({ items }: { items: TopProductRow[] }) {
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Trophy size={16} className="text-primary" />
          Top produits du jour
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune vente enregistrée aujourd&apos;hui pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={item.productId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 truncate">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="truncate">{item.nom}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium">{formatFcfa(item.total)}</span>
                  <span className="block text-xs text-muted-foreground">Qté {item.quantite}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
