"use client";

import { useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, MessageCircle, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/currency";
import type { RapportsData } from "./types";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildSummaryLines(data: RapportsData): string[] {
  const { kpis, argentEncaisse } = data;
  return [
    `Chiffre d'affaires : ${formatFcfa(kpis.chiffreAffaires)}`,
    `Ventes : ${kpis.ventes}`,
    `Marge brute : ${formatFcfa(kpis.margeBrute)} (${Math.round(kpis.margePct)}%)`,
    `Achats de stock : ${formatFcfa(kpis.achatsStock)}`,
    `Autres dépenses : ${formatFcfa(kpis.autresDepenses)}`,
    `Bénéfice net estimé : ${formatFcfa(kpis.beneficeNet)}`,
    `Espèces encaissées : ${formatFcfa(argentEncaisse.especes)}`,
    `Mobile Money : ${formatFcfa(argentEncaisse.mobileMoney)}`,
    `Vendu à crédit : ${formatFcfa(argentEncaisse.venduACredit)}`,
    `Remboursements de créances reçus : ${formatFcfa(argentEncaisse.remboursementsCreances)}`,
    `Reste en caisse (estimation période) : ${formatFcfa(argentEncaisse.resteEnCaisse)}`,
  ];
}

export function ExportButtons({ data, storeName }: { data: RapportsData; storeName: string }) {
  const [exportingPdf, setExportingPdf] = useState(false);

  const handlePdf = () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Rapport — ${storeName}`, 14, 16);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Période : ${data.period.label}`, 14, 23);

      autoTable(doc, {
        startY: 28,
        head: [["KPI", "Valeur", "vs période précédente"]],
        body: [
          ["Chiffre d'affaires", formatFcfa(data.kpis.chiffreAffaires), deltaLabel(data.deltas.chiffreAffaires)],
          ["Ventes", String(data.kpis.ventes), deltaLabel(data.deltas.ventes)],
          [`Marge brute (${Math.round(data.kpis.margePct)}%)`, formatFcfa(data.kpis.margeBrute), deltaLabel(data.deltas.margeBrute)],
          ["Achats de stock", formatFcfa(data.kpis.achatsStock), deltaLabel(data.deltas.achatsStock)],
          ["Autres dépenses", formatFcfa(data.kpis.autresDepenses), deltaLabel(data.deltas.autresDepenses)],
          ["Bénéfice net estimé", formatFcfa(data.kpis.beneficeNet), deltaLabel(data.deltas.beneficeNet)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 122, 87] },
      });

      const afterKpi = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: afterKpi,
        head: [["Argent encaissé", "Montant"]],
        body: [
          ["Espèces", formatFcfa(data.argentEncaisse.especes)],
          ["Mobile Money", formatFcfa(data.argentEncaisse.mobileMoney)],
          ["Vendu à crédit", formatFcfa(data.argentEncaisse.venduACredit)],
          ["Remboursements de créances reçus", formatFcfa(data.argentEncaisse.remboursementsCreances)],
          ["Reste en caisse (estimation période)", formatFcfa(data.argentEncaisse.resteEnCaisse)],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 122, 87] },
      });

      const afterCaisse = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      autoTable(doc, {
        startY: afterCaisse,
        head: [["#", "Produit", "Quantité", "Chiffre d'affaires"]],
        body: data.topProduits.map((p, i) => [String(i + 1), p.nom, String(p.quantite), formatFcfa(p.montant)]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 122, 87] },
      });

      doc.save(`rapport-${data.period.type}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCsv = () => {
    const rows: (string | number)[][] = [
      ["Rapport", storeName],
      ["Période", data.period.label],
      [],
      ["KPI", "Valeur", "vs période précédente (%)"],
      ["Chiffre d'affaires", data.kpis.chiffreAffaires, data.deltas.chiffreAffaires ?? ""],
      ["Ventes", data.kpis.ventes, data.deltas.ventes ?? ""],
      ["Marge brute", data.kpis.margeBrute, data.deltas.margeBrute ?? ""],
      ["Marge (%)", Math.round(data.kpis.margePct * 10) / 10, ""],
      ["Achats de stock", data.kpis.achatsStock, data.deltas.achatsStock ?? ""],
      ["Autres dépenses", data.kpis.autresDepenses, data.deltas.autresDepenses ?? ""],
      ["Bénéfice net estimé", data.kpis.beneficeNet, data.deltas.beneficeNet ?? ""],
      [],
      ["Argent encaissé", "Montant"],
      ["Espèces", data.argentEncaisse.especes],
      ["Mobile Money", data.argentEncaisse.mobileMoney],
      ["Vendu à crédit", data.argentEncaisse.venduACredit],
      ["Remboursements de créances reçus", data.argentEncaisse.remboursementsCreances],
      ["Reste en caisse (estimation période)", data.argentEncaisse.resteEnCaisse],
      [],
      ["Top produits", "Quantité", "Chiffre d'affaires"],
      ...data.topProduits.map((p) => [p.nom, p.quantite, p.montant]),
    ];
    const csv = Papa.unparse(rows);
    downloadBlob(`﻿${csv}`, `rapport-${data.period.type}-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
  };

  const handleWhatsapp = () => {
    const lines = [`*Rapport ${storeName}*`, `Période : ${data.period.label}`, "", ...buildSummaryLines(data)];
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handlePdf} disabled={exportingPdf}>
        <FileText size={16} /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleCsv}>
        <Sheet size={16} /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handleWhatsapp}>
        <MessageCircle size={16} /> WhatsApp
      </Button>
    </div>
  );
}

function deltaLabel(pct: number | null): string {
  if (pct === null) return "—";
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}
