"use client";

// « + Générer une facture » (§12) : recherche/sélection d'une vente existante de la boutique
// (réutilise GET /api/ventes du module Ventes, déjà scopé storeId + permission ventes.view.*),
// puis POST /api/documents { type: "FACTURE", saleId }.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/currency";

type SaleOption = {
  id: string;
  numero: string;
  dateHeure: string;
  statut: string;
  total: string | number;
  clientNom: string | null;
  premierArticle: string;
  itemsCount: number;
};

export function GenerateFactureDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sales, setSales] = useState<SaleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setLoading(true);
    fetch("/api/ventes")
      .then((res) => res.json())
      .then((data) => setSales((data.sales ?? []).filter((s: SaleOption) => s.statut === "VALIDEE")))
      .catch(() => toast.error("Impossible de charger les ventes"))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sales;
    return sales.filter(
      (s) =>
        s.numero.toLowerCase().includes(needle) ||
        (s.clientNom ?? "").toLowerCase().includes(needle) ||
        s.premierArticle.toLowerCase().includes(needle)
    );
  }, [sales, q]);

  async function handleSelect(sale: SaleOption) {
    setSubmitting(sale.id);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "FACTURE", saleId: sale.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la génération de la facture");
      toast.success(`Facture ${data.document.numero} générée`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Générer une facture depuis une vente">
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une vente (numéro, client, article)..."
          autoFocus
        />
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement des ventes...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune vente trouvée.</p>
          ) : (
            filtered.slice(0, 30).map((sale) => (
              <button
                key={sale.id}
                type="button"
                onClick={() => handleSelect(sale)}
                disabled={submitting !== null}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {sale.numero}
                    {submitting === sale.id ? <Badge tone="info">Génération...</Badge> : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {sale.clientNom ?? "Client de passage"} · {new Date(sale.dateHeure).toLocaleDateString("fr-FR")} ·{" "}
                    {sale.itemsCount} article(s)
                  </div>
                </div>
                <div className="shrink-0 font-semibold">{formatFcfa(sale.total)}</div>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
