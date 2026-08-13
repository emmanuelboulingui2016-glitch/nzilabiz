import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import { KpiPopover } from "./kpi-popover";
import type { ArgentEncaisse } from "./types";

function Row({ label, value, help }: { label: string; value: number; help?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {help ? <KpiPopover text={help} /> : null}
      </span>
      <span className="text-sm font-semibold">{formatFcfa(value)}</span>
    </div>
  );
}

export function ArgentEncaisseSection({ data }: { data: ArgentEncaisse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Argent encaissé</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Row label="Espèces" value={data.especes} />
        <Row label="Mobile Money" value={data.mobileMoney} />
        <Row
          label="Vendu à crédit"
          value={data.venduACredit}
          help="Montant des ventes de la période payées à crédit — pas encore réellement encaissé."
        />
        <Row
          label="Remboursements de créances reçus"
          value={data.remboursementsCreances}
          help="Argent reçu sur la période au titre de remboursements de créances (ventes à crédit passées)."
        />
        <Row
          label="Reste en caisse (estimation période)"
          value={data.resteEnCaisse}
          help="Espèces encaissées sur la vente moins les autres dépenses réglées en espèces sur la même période. C'est une estimation liée à cette période uniquement — elle ne tient pas compte d'un fond de caisse d'ouverture. Le vrai solde de caisse en temps réel se trouve sur le Tableau de bord."
        />
      </CardContent>
    </Card>
  );
}
