"use client";

import { Eye, Repeat, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/currency";
import { STATUT_LABELS, STATUT_TONES, type DocumentRow } from "./types";
import { buildDocumentWhatsappSummary } from "./whatsapp";

export function DocumentListItem({
  doc,
  canEdit,
  onView,
  onConvert,
}: {
  doc: DocumentRow;
  canEdit: boolean;
  onView: () => void;
  onConvert: () => void;
}) {
  const whatsappText = buildDocumentWhatsappSummary({
    numero: doc.numero,
    type: doc.type,
    clientNom: doc.clientNomAffiche,
    montantTotal: doc.montantTotal,
    date: doc.date,
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onView} className="truncate text-left font-semibold hover:underline">
              {doc.numero}
            </button>
            <Badge tone={STATUT_TONES[doc.statut]}>{STATUT_LABELS[doc.statut]}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {doc.clientNomAffiche ?? "Sans client"} · {new Date(doc.date).toLocaleDateString("fr-FR")}
            {doc.saleNumero ? ` · Vente ${doc.saleNumero}` : ""}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="text-right">
            <div className="text-lg font-bold">{formatFcfa(doc.montantTotal)}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" title="Voir / Imprimer" onClick={onView}>
              <Eye size={16} />
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Partager par WhatsApp"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#25D366] hover:bg-muted"
            >
              <Share2 size={16} />
            </a>
            {canEdit && doc.type === "PROFORMA" && doc.statut === "BROUILLON" ? (
              <Button variant="ghost" size="icon" title="Transformer en vente" onClick={onConvert}>
                <Repeat size={16} />
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
