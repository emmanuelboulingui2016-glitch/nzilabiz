"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

const TEMPLATE_CSV =
  "nom,categorie,codeBarres,prixAchat,prixVente,unite,quantiteStock,seuilAlerte\n" +
  "Riz 5kg,Alimentation,1234567890123,4500,5500,unité,20,5\n";

export function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
      error: () => toast.error("Impossible de lire ce fichier CSV."),
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-produits.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (rows.length === 0) {
      toast.error("Sélectionnez un fichier CSV contenant au moins une ligne.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/stock/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'import.");
        return;
      }
      setResult(data);
      toast.success(`${data.created} créé(s), ${data.updated} mis à jour, ${data.skipped} ignoré(s).`);
      onImported();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Importer des produits (CSV)" className="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Colonnes reconnues (insensible à la casse) : nom, catégorie, codeBarres, prixAchat, prixVente, prixGros,
          unité, quantiteStock, seuilAlerte. Les produits déjà connus (même code-barres) sont mis à jour, les autres
          sont créés avec une référence générée automatiquement.
        </p>

        <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
          Télécharger un modèle CSV
        </Button>

        <div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
          {fileName && (
            <p className="mt-1 text-xs text-muted-foreground">
              {fileName} — {rows.length} ligne(s) détectée(s)
            </p>
          )}
        </div>

        {result && (
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs">
            <p>
              {result.created} créé(s) · {result.updated} mis à jour · {result.skipped} ignoré(s)
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-danger">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Fermer
          </Button>
          <Button onClick={handleImport} disabled={importing || rows.length === 0}>
            {importing ? "Import en cours…" : `Importer (${rows.length})`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
