// Export CSV/PDF de l'historique des ventes — §7 🔧 "bouton d'export direct (CSV/PDF)... filtré
// selon les critères actifs". Les deux fonctions travaillent sur la liste déjà filtrée côté client.

import { PAIEMENT_LABELS, type SaleRow } from "./types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR");
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return { date, heure };
}

function articleLabel(sale: SaleRow) {
  const suffix = sale.itemsCount > 1 ? ` +${sale.itemsCount - 1}` : "";
  return `${sale.premierArticle}${suffix}`;
}

function paiementLabel(sale: SaleRow) {
  if (sale.paiements.length === 0) return "—";
  return [...new Set(sale.paiements)].map((m) => PAIEMENT_LABELS[m]).join(" + ");
}

function statutLabel(sale: SaleRow) {
  return sale.statut === "ANNULEE" ? "Annulée" : "Validée";
}

const HEADERS = ["N°", "Date", "Heure", "Article", "Client", "Qté", "Total (FCFA)", "Paiement", "Statut"];

function toRows(sales: SaleRow[]): string[][] {
  return sales.map((sale) => {
    const { date, heure } = formatDateTime(sale.dateHeure);
    return [
      sale.numero,
      date,
      heure,
      articleLabel(sale),
      sale.clientNom ?? "",
      String(sale.qte),
      sale.total,
      paiementLabel(sale),
      statutLabel(sale),
    ];
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string) {
  if (/[";\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportVentesCsv(sales: SaleRow[]) {
  const lines = [HEADERS, ...toRows(sales)].map((row) => row.map(csvEscape).join(";"));
  const csv = "﻿" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `ventes-${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportVentesPdf(sales: SaleRow[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Historique des ventes", 14, 14);
  doc.setFontSize(9);
  doc.text(`Exporté le ${new Date().toLocaleString("fr-FR")}`, 14, 20);

  autoTable(doc, {
    head: [HEADERS],
    body: toRows(sales),
    startY: 26,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 122, 87] },
  });

  doc.save(`ventes-${new Date().toISOString().slice(0, 10)}.pdf`);
}
