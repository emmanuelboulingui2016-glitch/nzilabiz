import { Badge } from "@/components/ui/badge";
import { STATUT_LABELS, STATUT_TONES, type StockStatus } from "@/components/stock/stock-utils";

export function StatusBadge({ statut }: { statut: StockStatus }) {
  return <Badge tone={STATUT_TONES[statut]}>{STATUT_LABELS[statut]}</Badge>;
}
