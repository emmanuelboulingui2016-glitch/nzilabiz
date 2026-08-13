import { Card } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { KpiPopover } from "./kpi-popover";
import type { KpiDeltas, RapportsKpis } from "./types";

function formatDelta(pct: number | null): { text: string; tone: "positive" | "negative" | "neutral" } {
  if (pct === null) return { text: "Stable vs période précédente", tone: "neutral" };
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  const tone = rounded > 0 ? "positive" : rounded < 0 ? "negative" : "neutral";
  return { text: `${sign}${rounded}% vs période précédente`, tone };
}

function KpiCard({
  label,
  value,
  help,
  deltaPct,
  invertTone = false,
}: {
  label: string;
  value: string;
  help: string;
  deltaPct: number | null;
  invertTone?: boolean;
}) {
  const delta = formatDelta(deltaPct);
  const tone = invertTone
    ? delta.tone === "positive"
      ? "negative"
      : delta.tone === "negative"
        ? "positive"
        : "neutral"
    : delta.tone;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <KpiPopover text={help} />
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      <div
        className={cn(
          "mt-1 text-xs font-medium",
          tone === "positive" && "text-success",
          tone === "negative" && "text-danger",
          tone === "neutral" && "text-muted-foreground"
        )}
      >
        {delta.text}
      </div>
    </Card>
  );
}

export function KpiGrid({ kpis, deltas }: { kpis: RapportsKpis; deltas: KpiDeltas }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label="Chiffre d'affaires"
        value={formatFcfa(kpis.chiffreAffaires)}
        deltaPct={deltas.chiffreAffaires}
        help="Le total de toutes les ventes validées sur la période (avant de retirer vos coûts et vos dépenses)."
      />
      <KpiCard
        label="Ventes"
        value={String(kpis.ventes)}
        deltaPct={deltas.ventes}
        help="Le nombre de tickets de vente validés sur la période (les ventes annulées ne sont pas comptées)."
      />
      <KpiCard
        label={`Marge brute (${Math.round(kpis.margePct)}%)`}
        value={formatFcfa(kpis.margeBrute)}
        deltaPct={deltas.margeBrute}
        help="Ce qu'il vous reste après avoir retiré le prix d'achat de chaque article vendu (au prix d'achat au moment de la vente, même si vos prix ont changé depuis). Le % est la marge divisée par le chiffre d'affaires."
      />
      <KpiCard
        label="Achats de stock"
        value={formatFcfa(kpis.achatsStock)}
        deltaPct={deltas.achatsStock}
        invertTone
        help="Ce que vous avez dépensé pour racheter de la marchandise sur la période. Déjà pris en compte dans la marge brute — on ne le retire pas une deuxième fois du bénéfice net."
      />
      <KpiCard
        label="Autres dépenses"
        value={formatFcfa(kpis.autresDepenses)}
        deltaPct={deltas.autresDepenses}
        invertTone
        help="Vos charges hors achat de marchandise (loyer, salaires, transport, électricité...) réglées sur la période."
      />
      <KpiCard
        label="Bénéfice net estimé"
        value={formatFcfa(kpis.beneficeNet)}
        deltaPct={deltas.beneficeNet}
        help="Ce que vous avez gagné sur la période (marge brute − autres dépenses). Attention : ce n'est pas forcément l'argent physiquement en caisse — certaines ventes sont à crédit, pas encore encaissées."
      />
    </div>
  );
}
