import { Banknote, Smartphone, HandCoins, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import type { DashboardData } from "./types";

// §5 Bloc "Encaissé aujourd'hui" + Reste en caisse (fond d'ouverture + espèces − dépenses espèces)
export function EncaisseBlock({ encaisse, caisse }: { encaisse: DashboardData["encaisse"]; caisse: DashboardData["caisse"] }) {
  const rows = [
    { label: "Espèces", value: encaisse.especes, icon: Banknote },
    { label: "Mobile Money", value: encaisse.mobileMoney, icon: Smartphone },
    { label: "Vendu à crédit", value: encaisse.credit, icon: HandCoins },
  ];

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-foreground">Encaissé aujourd&apos;hui</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <row.icon size={16} />
              {row.label}
            </span>
            <span className="font-medium">{formatFcfa(row.value)}</span>
          </div>
        ))}

        <div className="my-2 border-t border-border" />

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Fond de caisse d&apos;ouverture</span>
            <span>{formatFcfa(caisse.fondOuverture)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>+ Espèces encaissées</span>
            <span>{formatFcfa(caisse.especesEncaissees)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>− Dépenses réglées en espèces</span>
            <span>{formatFcfa(caisse.depensesEspeces)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold">
          <span className="flex items-center gap-2 text-primary">
            <Wallet size={16} />
            Reste en caisse
          </span>
          <span className="text-primary">{formatFcfa(caisse.resteEnCaisse)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
