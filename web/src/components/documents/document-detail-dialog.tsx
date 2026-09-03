"use client";

// Vue détail imprimable + partage WhatsApp individuel (§12 Amélioration). Vue print-optimisée
// via @media print (même approche que src/components/vendre/receipt-view.tsx) — pas de librairie
// PDF nécessaire, window.print() suffit.

import { useEffect, useState } from "react";
import { Printer, Share2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/currency";
import { STATUT_LABELS, STATUT_TONES, TYPE_LABELS, type DocumentDetail, type SaleDetail } from "./types";
import { buildDocumentWhatsappSummary } from "./whatsapp";

export function DocumentDetailDialog({ documentId, onClose }: { documentId: string | null; onClose: () => void }) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setSale(null);
      return;
    }
    setLoading(true);
    fetch(`/api/documents/${documentId}`)
      .then((res) => res.json())
      .then((data) => {
        setDoc(data.document ?? null);
        setSale(data.sale ?? null);
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  if (!documentId) return null;

  const clientNom = doc?.clientNom ?? doc?.clientNomLibre ?? "Client de passage";
  const lignes: Array<{ nom?: string; productNom?: string; quantite: number; sousTotal: number }> =
    sale?.items ?? doc?.itemsBrouillon ?? [];
  const whatsappText = doc
    ? buildDocumentWhatsappSummary({
        numero: doc.numero,
        type: doc.type,
        clientNom: doc.clientNom ?? doc.clientNomLibre,
        montantTotal: doc.montantTotal,
        date: doc.date,
      })
    : "";

  return (
    <Dialog open={!!documentId} onClose={onClose} title={doc ? `${TYPE_LABELS[doc.type]} ${doc.numero}` : "Document"}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #nzilabiz-document, #nzilabiz-document * { visibility: visible; }
          #nzilabiz-document { position: fixed; inset: 0; width: 100%; padding: 16px; }
        }
      `}</style>

      {loading || !doc ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-4">
          <div id="nzilabiz-document" className="rounded-lg border border-dashed border-border p-4 text-sm">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-base font-semibold">{TYPE_LABELS[doc.type]}</p>
                <p className="text-muted-foreground">N° {doc.numero}</p>
                <p className="text-muted-foreground">{new Date(doc.date).toLocaleDateString("fr-FR")}</p>
              </div>
              <Badge tone={STATUT_TONES[doc.statut]}>{STATUT_LABELS[doc.statut]}</Badge>
            </div>
            <p className="mb-2">Client : {clientNom}</p>
            <div className="my-2 border-t border-dashed border-border" />
            <div className="space-y-1">
              {lignes.map((item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="flex-1">
                    {item.productNom ?? item.nom} × {item.quantite}
                  </span>
                  <span>{formatFcfa(item.sousTotal)}</span>
                </div>
              ))}
              {lignes.length === 0 ? <p className="text-muted-foreground">Aucune ligne.</p> : null}
            </div>
            <div className="my-2 border-t border-dashed border-border" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatFcfa(doc.montantTotal)}</span>
            </div>
            {doc.saleId && sale ? <p className="mt-2 text-xs text-muted-foreground">Vente liée : {sale.numero}</p> : null}
            {doc.convertieEnVenteId ? (
              <p className="mt-1 text-xs text-muted-foreground">Cette proforma a été transformée en vente.</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 print:hidden">
            <Button type="button" variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer size={16} /> Imprimer
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              <Share2 size={16} /> Partager WhatsApp
            </a>
          </div>
        </div>
      )}
    </Dialog>
  );
}
