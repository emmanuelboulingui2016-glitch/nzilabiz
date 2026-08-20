"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { formatFcfa } from "@/lib/currency";
import { TYPE_LABELS, type DocumentRow, type DocumentType } from "./types";
import { DocumentListItem } from "./document-list-item";
import { GenerateFactureDialog } from "./generate-facture-dialog";
import { NewProformaDialog } from "./new-proforma-dialog";
import { DocumentDetailDialog } from "./document-detail-dialog";
import { ConvertProformaDialog } from "./convert-proforma-dialog";

const TABS: { value: DocumentType; label: string }[] = [
  { value: "FACTURE", label: "Factures" },
  { value: "PROFORMA", label: "Proformas" },
  { value: "REMBOURSEMENT", label: "Remboursements" },
];

export function DocumentsClient({ initial, canEdit }: { initial: DocumentRow[]; canEdit: boolean }) {
  const [tab, setTab] = useState<DocumentType>("FACTURE");
  // Onglet Factures rendu par le serveur avec la page : rien à recharger à l'affichage.
  const [rows, setRows] = useState<DocumentRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [showGenerate, setShowGenerate] = useState(false);
  const [showNewProforma, setShowNewProforma] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({ type: tab });
      if (q.trim()) searchParams.set("q", q.trim());
      const res = await fetch(`/api/documents?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Impossible de charger les documents");
      const data = await res.json();
      setRows(data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, [tab, q]);

  // Le premier passage est ignoré : l'onglet Factures est déjà rendu. Les suivants correspondent à
  // un changement d'onglet ou à une recherche.
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const timeout = setTimeout(load, 250); // debounce recherche
    return () => clearTimeout(timeout);
  }, [load]);

  const total = useMemo(() => rows.reduce((sum, r) => sum + r.montantTotal, 0), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onChange={(v) => setTab(v as DocumentType)} tabs={TABS} />
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowNewProforma(true)}>
              <Plus size={16} /> Nouvelle proforma
            </Button>
            <Button size="sm" onClick={() => setShowGenerate(true)}>
              <FileText size={16} /> Générer une facture
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label={`${TYPE_LABELS[tab]} — total affiché`} value={formatFcfa(total)} />
        <StatCard label="Nombre de documents" value={rows.length} />
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher par numéro ou client..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {tab === "REMBOURSEMENT"
              ? "Aucun remboursement pour le moment. Cette section se remplira automatiquement le jour où les " +
                "remboursements de créances (module Créances) seront connectés aux documents — voir résumé du module."
              : "Aucun document pour le moment."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <DocumentListItem
              key={r.id}
              doc={r}
              canEdit={canEdit}
              onView={() => setDetailId(r.id)}
              onConvert={() => setConvertId(r.id)}
            />
          ))}
        </div>
      )}

      <GenerateFactureDialog open={showGenerate} onClose={() => setShowGenerate(false)} onCreated={load} />
      <NewProformaDialog open={showNewProforma} onClose={() => setShowNewProforma(false)} onCreated={load} />
      <DocumentDetailDialog documentId={detailId} onClose={() => setDetailId(null)} />
      <ConvertProformaDialog
        documentId={convertId}
        onClose={() => setConvertId(null)}
        onConverted={() => {
          setConvertId(null);
          load();
        }}
      />
    </div>
  );
}
