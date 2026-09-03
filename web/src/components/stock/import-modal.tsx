"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

// Doit rester cohérent avec les bornes serveur (route d'import) : elles seules font foi, ceci n'est
// qu'un message d'avertissement immédiat pour éviter à l'utilisateur d'attendre l'aller-retour.
const TAILLE_MAX_OCTETS = 5_000_000;

/** Lit le fichier choisi et renvoie son contenu en base64 pur (sans le préfixe "data:...;base64,"). */
function lireFichierEnBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultat = reader.result as string;
      const virgule = resultat.indexOf(",");
      resolve(virgule >= 0 ? resultat.slice(virgule + 1) : resultat);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (selected: File | null) => {
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!/\.xlsx$/i.test(selected.name)) {
      toast.error("Choisissez un classeur Excel (.xlsx).");
      setFile(null);
      return;
    }
    if (selected.size > TAILLE_MAX_OCTETS) {
      toast.error("Ce fichier est trop volumineux (5 Mo maximum). Réduisez-le et réessayez.");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Sélectionnez un classeur Excel (.xlsx) avant d'importer.");
      return;
    }
    setImporting(true);
    try {
      const contenu = await lireFichierEnBase64(file);
      const res = await fetch("/api/stock/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomFichier: file.name, contenu }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'import.");
        return;
      }
      setResult(data);
      toast.success(`${data.created} créé(s), ${data.updated} mis à jour, ${data.skipped} ignoré(s).`);
      onImported();
    } catch {
      toast.error("Impossible de lire ce fichier.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Importer des produits depuis Excel" className="max-w-xl">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Classeur Excel (.xlsx), 5 Mo et 5 000 lignes maximum. Colonnes reconnues (insensible
          à la casse) : nom, catégorie, codeBarres, prixAchat, prixVente, prixGros, unité, quantiteStock,
          seuilAlerte. Les produits déjà connus (même code-barres) sont mis à jour, les autres sont créés avec une
          référence générée automatiquement.
        </p>

        {/* Un lien de téléchargement, pas un bouton qui déplace la page : le modèle est fabriqué
            par le serveur, qui possède déjà la bibliothèque Excel. L'embarquer dans le navigateur
            pour produire un fichier d'exemple de deux lignes aurait alourdi le paquet envoyé à un
            commerçant en 3G. */}
        <a
          href="/api/stock/products/import"
          download="modele-produits.xlsx"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Télécharger le modèle Excel
        </a>

        <div>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
          {file && (
            <p className="mt-1 text-xs text-muted-foreground">
              {file.name} — {(file.size / 1024).toFixed(0)} Ko
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
          <Button onClick={handleImport} disabled={importing || !file}>
            {importing ? "Import en cours…" : "Importer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
