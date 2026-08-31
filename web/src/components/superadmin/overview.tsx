"use client";

// Vue d'ensemble de la plateforme : les chiffres et les courbes qu'on veut voir en ouvrant
// l'administration.

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Building2, Receipt, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatFcfa } from "@/lib/currency";
import { InscriptionsChart, PlansChart, TopStoresChart, VolumeChart } from "./charts";

type Stats = {
  boutiques: number;
  boutiquesActives30j: number;
  nouvellesBoutiques7j: number;
  essaisExpirantSous7j: number;
  utilisateurs: number;
  produits: number;
  clients: number;
  ventes: number;
  volumeTotal: number;
  ventes30j: number;
  volume30j: number;
  parPlan: Record<string, number>;
  inscriptions: { semaine: string; nb: number }[];
  volumeMensuel: { mois: string; volume: number; ventes: number }[];
  topBoutiques: { nom: string; volume: number }[];
};

export function SuperAdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then(setStats)
      .catch(() => setErreur("Impossible de charger les statistiques."));
  }, []);

  if (erreur) return <p className="text-sm text-danger">{erreur}</p>;
  if (!stats) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  const tauxActivite =
    stats.boutiques > 0 ? Math.round((stats.boutiquesActives30j / stats.boutiques) * 100) : 0;

  const inscriptions = stats.inscriptions.map((i) => ({
    label: format(parseISO(i.semaine), "d MMM", { locale: fr }),
    nb: i.nb,
  }));

  const volumes = stats.volumeMensuel.map((v) => ({
    label: format(parseISO(`${v.mois}-01`), "MMM yy", { locale: fr }),
    volume: v.volume,
    ventes: v.ventes,
  }));

  const plans = (["ESSAI", "ESSENTIEL", "PREMIUM", "ENTREPRISE"] as const)
    .map((plan) => ({ plan, nb: stats.parPlan[plan] ?? 0 }))
    .filter((p) => p.nb > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Vue d&apos;ensemble</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;état de la plateforme, toutes boutiques confondues.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Boutiques"
          value={stats.boutiques}
          icon={<Building2 size={18} />}
          delta={
            stats.nouvellesBoutiques7j > 0
              ? `+${stats.nouvellesBoutiques7j} cette semaine`
              : "Aucune nouvelle cette semaine"
          }
          deltaTone={stats.nouvellesBoutiques7j > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Actives (30 j)"
          value={stats.boutiquesActives30j}
          icon={<TrendingUp size={18} />}
          delta={`${tauxActivite} % du parc`}
          deltaTone={tauxActivite >= 50 ? "positive" : "negative"}
          helpText="Boutiques ayant enregistré au moins une vente dans les 30 derniers jours."
        />
        <StatCard label="Utilisateurs" value={stats.utilisateurs} icon={<Users size={18} />} />
        <StatCard
          label="Ventes (30 j)"
          value={stats.ventes30j}
          icon={<Receipt size={18} />}
          delta={formatFcfa(stats.volume30j)}
        />
      </div>

      {stats.essaisExpirantSous7j > 0 ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle size={18} className="shrink-0 text-warning" />
            <p className="text-sm">
              <strong>{stats.essaisExpirantSous7j}</strong> essai
              {stats.essaisExpirantSous7j > 1 ? "s arrivent" : " arrive"} à échéance dans les 7 jours —{" "}
              <Link href="/superadmin/boutiques?plan=ESSAI" className="font-semibold text-primary underline">
                voir les boutiques concernées
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Volume encaissé par mois</CardTitle>
            <p className="text-xs text-muted-foreground">Ventes validées de toutes les boutiques, 6 derniers mois.</p>
          </CardHeader>
          <CardContent>
            {volumes.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              <VolumeChart data={volumes} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Répartition par formule</CardTitle>
          </CardHeader>
          <CardContent>
            <PlansChart data={plans} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Inscriptions</CardTitle>
            <p className="text-xs text-muted-foreground">Nouvelles boutiques par semaine, 12 dernières semaines.</p>
          </CardHeader>
          <CardContent>
            {inscriptions.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune inscription sur la période.</p>
            ) : (
              <InscriptionsChart data={inscriptions} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Boutiques les plus actives</CardTitle>
            <p className="text-xs text-muted-foreground">Classement par volume encaissé depuis le début.</p>
          </CardHeader>
          <CardContent>
            <TopStoresChart data={stats.topBoutiques} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Volume total encaissé"
          value={formatFcfa(stats.volumeTotal)}
          helpText="Somme des ventes validées de toutes les boutiques."
        />
        <StatCard label="Ventes cumulées" value={stats.ventes} />
        <StatCard label="Produits au catalogue" value={stats.produits} />
        <StatCard label="Fiches clients" value={stats.clients} />
      </div>
    </div>
  );
}
