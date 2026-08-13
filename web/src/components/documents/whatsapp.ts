// Partage WhatsApp par document individuel (§12 🔧 Amélioration).
// Même stratégie que src/components/vendre/receipt-view.tsx et
// src/components/creances/relance-dialog.tsx : lien https://wa.me/?text=... pré-rempli, sans API tierce.

import { formatFcfa } from "@/lib/currency";
import { TYPE_LABELS, type DocumentType } from "./types";

export function buildDocumentWhatsappSummary(doc: {
  numero: string;
  type: DocumentType;
  clientNom: string | null;
  montantTotal: number;
  date: string;
}): string {
  const lines = [
    `${TYPE_LABELS[doc.type]} ${doc.numero}`,
    doc.clientNom ? `Client : ${doc.clientNom}` : null,
    new Date(doc.date).toLocaleDateString("fr-FR"),
    `Montant : ${formatFcfa(doc.montantTotal)}`,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}
