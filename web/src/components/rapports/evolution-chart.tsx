"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import type { EvolutionPoint } from "./types";

export function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  const hasData = data.some((d) => d.ca > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution des ventes</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucune vente sur cette période.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rapportsCaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-border)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-border)"
                  width={56}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(value) => [formatFcfa(Number(value ?? 0)), "CA"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, borderColor: "var(--color-border)" }}
                />
                <Area type="monotone" dataKey="ca" stroke="var(--color-primary)" fill="url(#rapportsCaFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
