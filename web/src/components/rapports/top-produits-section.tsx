"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { formatFcfa } from "@/lib/currency";
import type { TopProduitRow } from "./types";

type SortKey = "montant" | "quantite";

export function TopProduitsSection({ produits }: { produits: TopProduitRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("montant");

  const sorted = useMemo(() => [...produits].sort((a, b) => b[sortKey] - a[sortKey]), [produits, sortKey]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Top produits</CardTitle>
        <Tabs
          tabs={[
            { value: "montant", label: "Par CA" },
            { value: "quantite", label: "Par quantité" },
          ]}
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
        />
      </CardHeader>
      <CardContent className="pt-0">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune vente sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Produit</th>
                  <th className="py-2 pr-2 text-right">Quantité</th>
                  <th className="py-2 pl-2 text-right">Chiffre d'affaires</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.productId} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-2 font-medium">{p.nom}</td>
                    <td className="py-2 pr-2 text-right">{p.quantite}</td>
                    <td className="py-2 pl-2 text-right">{formatFcfa(p.montant)}</td>
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
