"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import { A_PAYER_NOTE, type StockKpis } from "@/components/stock/stock-utils";
import { cn } from "@/lib/utils";

export function KpiCards({ kpis }: { kpis: StockKpis }) {
  const [aPayerOpen, setAPayerOpen] = useState(false);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card className="p-4">
        <span className="text-sm text-muted-foreground">Total produits</span>
        <div className="mt-1 text-2xl font-bold tracking-tight">{kpis.totalProduits}</div>
      </Card>
      <Card className="p-4">
        <span className="text-sm text-muted-foreground">Valeur du stock</span>
        <div className="mt-1 text-2xl font-bold tracking-tight">{formatFcfa(kpis.valeurStock)}</div>
      </Card>
      <Card className="p-4">
        <span className="text-sm text-muted-foreground">Stock faible</span>
        <div className="mt-1 text-2xl font-bold tracking-tight text-warning">{kpis.stockFaible}</div>
      </Card>
      <Card className="p-4">
        <span className="text-sm text-muted-foreground">Rupture de stock</span>
        <div className="mt-1 text-2xl font-bold tracking-tight text-danger">{kpis.ruptureStock}</div>
      </Card>
      <Card className="col-span-2 p-4 sm:col-span-1">
        <button
          type="button"
          onClick={() => setAPayerOpen((v) => !v)}
          className="flex w-full items-start justify-between text-left"
        >
          <span className="text-sm text-muted-foreground">À payer</span>
          {aPayerOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>
        <div className="mt-1 text-2xl font-bold tracking-tight">{formatFcfa(kpis.aPayer)}</div>
        <div className={cn("mt-2 text-xs leading-snug text-muted-foreground", !aPayerOpen && "hidden")}>{A_PAYER_NOTE}</div>
      </Card>
    </div>
  );
}
