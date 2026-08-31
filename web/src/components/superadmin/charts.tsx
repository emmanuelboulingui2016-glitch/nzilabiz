"use client";

// Graphiques de l'administration — Recharts, déjà utilisé par les rapports de la boutique, avec
// les mêmes couleurs de thème (variables CSS) pour rester lisible en clair comme en sombre.

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatFcfa } from "@/lib/currency";

const infobulle = {
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 13,
  color: "var(--color-foreground)",
};

export function InscriptionsChart({ data }: { data: { label: string; nb: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradInscriptions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={infobulle} formatter={(v) => [`${v}`, "Boutiques créées"]} />
          <Area
            type="monotone"
            dataKey="nb"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#gradInscriptions)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VolumeChart({ data }: { data: { label: string; volume: number; ventes: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis width={0} tick={false} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--color-muted)" }}
            contentStyle={infobulle}
            formatter={(value, name) =>
              name === "volume" ? [formatFcfa(Number(value) || 0), "Volume"] : [`${value}`, "Ventes"]
            }
          />
          <Bar dataKey="volume" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const COULEURS_PLAN: Record<string, string> = {
  ESSAI: "var(--color-warning)",
  PREMIUM: "var(--color-primary)",
  ESSENTIEL: "var(--color-emeraude)",
  ENTREPRISE: "var(--color-accent)",
};

export function PlansChart({ data }: { data: { plan: string; nb: number }[] }) {
  const total = data.reduce((s, d) => s + d.nb, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Aucune boutique pour l&apos;instant.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="nb" nameKey="plan" innerRadius={48} outerRadius={78} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.plan} fill={COULEURS_PLAN[d.plan] ?? "var(--color-muted-foreground)"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={infobulle}
            formatter={(v, n) => [`${v} boutique${Number(v) > 1 ? "s" : ""}`, String(n)]}
          />
          <Legend
            verticalAlign="bottom"
            height={24}
            formatter={(value) => <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopStoresChart({ data }: { data: { nom: string; volume: number }[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente enregistrée.</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nom"
            width={120}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)" }}
            contentStyle={infobulle}
            formatter={(v) => [formatFcfa(Number(v) || 0), "Volume"]}
          />
          <Bar dataKey="volume" fill="var(--color-primary)" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
