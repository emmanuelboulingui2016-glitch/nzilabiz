"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { KpiGrid } from "./kpi-grid";
import { PeriodFilter } from "./period-filter";
import { ArgentEncaisseSection } from "./argent-encaisse-section";
import { EvolutionChart } from "./evolution-chart";
import { TopProduitsSection } from "./top-produits-section";
import { ExportButtons } from "./export-buttons";
import type { PeriodType, RapportsData } from "./types";

export function RapportsClient({ storeName, initialData }: { storeName: string; initialData: RapportsData }) {
  const [period, setPeriod] = useState<PeriodType>(initialData.period.type);
  const [customStart, setCustomStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [data, setData] = useState<RapportsData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: PeriodType, start?: string, end?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period: p });
      if (p === "custom" && start && end) {
        params.set("start", start);
        params.set("end", end);
      }
      const res = await fetch(`/api/rapports?${params.toString()}`);
      if (!res.ok) throw new Error("Impossible de charger le rapport.");
      const json: RapportsData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period !== "custom") {
      load(period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rapports</h1>
          <p className="text-sm text-muted-foreground">{data.period.label}</p>
        </div>
        <ExportButtons data={data} storeName={storeName} />
      </div>

      <PeriodFilter
        period={period}
        onPeriodChange={setPeriod}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onApplyCustom={() => load("custom", customStart, customEnd)}
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <KpiGrid kpis={data.kpis} deltas={data.deltas} />

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ArgentEncaisseSection data={data.argentEncaisse} />
          <EvolutionChart data={data.evolution} />
        </div>

        <div className="mt-4">
          <TopProduitsSection produits={data.topProduits} />
        </div>
      </div>
    </div>
  );
}
