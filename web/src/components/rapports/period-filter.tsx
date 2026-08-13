"use client";

import { Tabs } from "@/components/ui/tabs";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PeriodType } from "./types";

const PERIOD_TABS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
  { value: "custom", label: "Personnalisé" },
];

export function PeriodFilter({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustom,
}: {
  period: PeriodType;
  onPeriodChange: (p: PeriodType) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onApplyCustom: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <Tabs tabs={PERIOD_TABS} value={period} onChange={(v) => onPeriodChange(v as PeriodType)} />
      </div>
      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label htmlFor="rapport-start">Du</Label>
            <Input
              id="rapport-start"
              type="date"
              value={customStart}
              max={customEnd || undefined}
              onChange={(e) => onCustomStartChange(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label htmlFor="rapport-end">Au</Label>
            <Input
              id="rapport-end"
              type="date"
              value={customEnd}
              min={customStart || undefined}
              onChange={(e) => onCustomEndChange(e.target.value)}
              className="w-40"
            />
          </div>
          <Button size="md" onClick={onApplyCustom} disabled={!customStart || !customEnd}>
            Appliquer
          </Button>
        </div>
      )}
    </div>
  );
}
