"use client";

// Écran Ventes — historique (§7 du cahier des charges). KPI cards, filtres (période / mode de
// paiement / recherche article), tableau, annulation avec motif obligatoire + workflow
// d'approbation, panneau "Demandes en attente" (Patron/Gérant), export CSV/PDF.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DonneesVentes } from "@/components/ventes/get-ventes-data";
import { CreditCard, Download, Eye, FileDown, Receipt, Search, Wallet, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import { AnnulerDialog } from "./annuler-dialog";
import { ApprobationsPanel } from "./approbations-panel";
import { SaleDetailDialog } from "./sale-detail-dialog";
import { exportVentesCsv, exportVentesPdf } from "./export-utils";
import { PAIEMENT_LABELS, type ApprovalRequestRow, type SaleRow, type VentesKpis } from "./types";

type Periode = "today" | "7j" | "30j" | "mois" | "tout";

const PERIODE_OPTIONS: { value: Periode; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7j", label: "7 derniers jours" },
  { value: "30j", label: "30 derniers jours" },
  { value: "mois", label: "Ce mois-ci" },
  { value: "tout", label: "Tout" },
];

function computeRange(periode: Periode): { from?: string; to?: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (periode === "tout") return {};

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (periode === "today") {
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (periode === "7j") {
    start.setDate(start.getDate() - 6);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (periode === "30j") {
    start.setDate(start.getDate() - 29);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  // mois
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: monthStart.toISOString(), to: end.toISOString() };
}

export function VentesClient({
  initial,
  canAnnulerDirect,
  canAnnulerDemander,
  canDecider,
  canViewAll,
}: {
  /** Ventes du jour rendues par le serveur avec la page : rien à recharger à l'affichage. */
  initial: DonneesVentes;
  canAnnulerDirect: boolean;
  canAnnulerDemander: boolean;
  canDecider: boolean;
  canViewAll: boolean;
}) {
  const [periode, setPeriode] = useState<Periode>("today");
  const [paiement, setPaiement] = useState("");
  const [q, setQ] = useState("");
  const [sales, setSales] = useState<SaleRow[]>(initial.sales);
  const [kpis, setKpis] = useState<VentesKpis | null>(initial.kpis);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequestRow[]>([]);

  const [viewSale, setViewSale] = useState<SaleRow | null>(null);
  const [cancelSale, setCancelSale] = useState<SaleRow | null>(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = computeRange(periode);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (paiement) params.set("paiement", paiement);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/ventes?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setSales(data.sales ?? []);
      setKpis(data.kpis ?? null);
    } finally {
      setLoading(false);
    }
  }, [periode, paiement, q]);

  const loadRequests = useCallback(async () => {
    if (!canDecider) return;
    const res = await fetch("/api/ventes/approbations");
    if (!res.ok) return;
    const data = await res.json();
    setRequests(data.requests ?? []);
  }, [canDecider]);

  // Le premier passage est ignoré : « Aujourd'hui » est déjà rendu par le serveur. Les suivants
  // correspondent à un vrai changement de période, de mode de paiement ou de recherche.
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      void loadSales();
    }, 250);
    return () => clearTimeout(timeout);
  }, [loadSales]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const refreshAll = () => {
    void loadSales();
    void loadRequests();
  };

  const canAnnuler = canAnnulerDirect || canAnnulerDemander;

  const rows = useMemo(
    () =>
      sales.map((sale) => {
        const dt = new Date(sale.dateHeure);
        return {
          sale,
          date: dt.toLocaleDateString("fr-FR"),
          heure: dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        };
      }),
    [sales]
  );

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Ventes</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportVentesCsv(sales)} disabled={sales.length === 0}>
            <Download size={16} />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportVentesPdf(sales)} disabled={sales.length === 0}>
            <FileDown size={16} />
            PDF
          </Button>
        </div>
      </div>

      {canDecider && <ApprobationsPanel requests={requests} onDecided={refreshAll} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="CA aujourd'hui"
          value={kpis ? formatFcfa(kpis.caAujourdhui) : "—"}
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="Transactions"
          value={kpis ? kpis.transactions : "—"}
          icon={<Receipt size={18} />}
          helpText="Ventes validées aujourd'hui"
        />
        <StatCard
          label="Ventes à crédit"
          value={kpis ? formatFcfa(kpis.ventesCredit.montant) : "—"}
          delta={kpis ? `${kpis.ventesCredit.count} vente(s) aujourd'hui` : undefined}
          icon={<CreditCard size={18} />}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="min-w-[160px]">
            <Select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)}>
              {PERIODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Select value={paiement} onChange={(e) => setPaiement(e.target.value)}>
              <option value="">Tous les paiements</option>
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CREDIT">Crédit</option>
            </Select>
          </div>
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un article..."
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">N°</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Heure</th>
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Paiement</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sale, date, heure }) => (
                <tr key={sale.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{sale.numero}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{heure}</td>
                  <td className="px-3 py-2">
                    <p>
                      {sale.premierArticle}
                      {sale.itemsCount > 1 && (
                        <span className="text-muted-foreground"> +{sale.itemsCount - 1}</span>
                      )}
                    </p>
                    {sale.clientNom && sale.paiements.includes("CREDIT") && (
                      <p className="text-xs text-muted-foreground">Client : {sale.clientNom}</p>
                    )}
                    {canViewAll && sale.vendeurNom && (
                      <p className="text-xs text-muted-foreground">Vendeur : {sale.vendeurNom}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{sale.qte}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatFcfa(sale.total)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {sale.statut === "ANNULEE" ? (
                        <Badge tone="danger">Annulée</Badge>
                      ) : (
                        [...new Set(sale.paiements)].map((mode) => (
                          <Badge key={mode} tone={mode === "CREDIT" ? "warning" : "success"}>
                            {PAIEMENT_LABELS[mode]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Voir" onClick={() => setViewSale(sale)}>
                        <Eye size={16} />
                      </Button>
                      {canAnnuler && sale.statut === "VALIDEE" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Annuler"
                          onClick={() => setCancelSale(sale)}
                        >
                          <XCircle size={16} className="text-danger" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Aucune vente pour les filtres sélectionnés.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {viewSale && <SaleDetailDialog sale={viewSale} onClose={() => setViewSale(null)} />}
      {cancelSale && (
        <AnnulerDialog
          sale={cancelSale}
          canDirect={canAnnulerDirect}
          onClose={() => setCancelSale(null)}
          onDone={() => {
            setCancelSale(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
