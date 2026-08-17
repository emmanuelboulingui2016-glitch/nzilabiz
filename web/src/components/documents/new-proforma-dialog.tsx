"use client";

// « Nouvelle proforma » (§12 🔧 Amélioration) : créée indépendamment d'une vente, pour un client
// professionnel qui n'a pas encore payé. Client existant (recherché via GET /api/creances/clients,
// module Créances) OU nom libre. Lignes libres (nom / quantité / prix), pas liées à un vrai Product
// — c'est l'étape de conversion qui exigera cette association, voir ConvertProformaDialog.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";

type ClientOption = { id: string; nom: string };
type Line = { nom: string; quantite: string; prixUnitaire: string };

const EMPTY_LINE: Line = { nom: "", quantite: "1", prixUnitaire: "0" };

export function NewProformaDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clientsList, setClientsList] = useState<ClientOption[]>([]);
  const [clientMode, setClientMode] = useState<"libre" | "existant">("libre");
  const [clientId, setClientId] = useState("");
  const [clientNomLibre, setClientNomLibre] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientMode("libre");
    setClientId("");
    setClientNomLibre("");
    setLines([{ ...EMPTY_LINE }]);
    fetch("/api/creances/clients")
      .then((res) => res.json())
      .then((data) =>
        setClientsList(
          (data.clients ?? [])
            // On n'émet pas de nouveau document au nom d'un client archivé.
            .filter((c: { archive?: boolean }) => !c.archive)
            .map((c: { id: string; nom: string }) => ({ id: c.id, nom: c.nom }))
        )
      )
      .catch(() => {});
  }, [open]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0),
    [lines]
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }
  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit() {
    const validLines = lines.filter((l) => l.nom.trim() && Number(l.quantite) > 0);
    if (validLines.length === 0) {
      toast.error("Ajoutez au moins une ligne avec un nom et une quantité.");
      return;
    }
    if (clientMode === "existant" && !clientId) {
      toast.error("Sélectionnez un client.");
      return;
    }
    if (clientMode === "libre" && !clientNomLibre.trim()) {
      toast.error("Indiquez le nom du client.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PROFORMA",
          clientId: clientMode === "existant" ? clientId : null,
          clientNomLibre: clientMode === "libre" ? clientNomLibre.trim() : null,
          items: validLines.map((l) => ({
            nom: l.nom.trim(),
            quantite: Number(l.quantite),
            prixUnitaire: Number(l.prixUnitaire) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la création de la proforma");
      toast.success(`Proforma ${data.document.numero} créée`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nouvelle proforma" className="max-w-xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Client</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={clientMode === "libre" ? "primary" : "outline"}
              onClick={() => setClientMode("libre")}
            >
              Nom libre
            </Button>
            <Button
              type="button"
              size="sm"
              variant={clientMode === "existant" ? "primary" : "outline"}
              onClick={() => setClientMode("existant")}
            >
              Client enregistré
            </Button>
          </div>
          {clientMode === "libre" ? (
            <Input
              value={clientNomLibre}
              onChange={(e) => setClientNomLibre(e.target.value)}
              placeholder="Nom du client professionnel..."
            />
          ) : (
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sélectionner un client...</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Lignes (produits ou prestations)</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus size={14} /> Ligne
            </Button>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-5"
                  placeholder="Désignation"
                  value={line.nom}
                  onChange={(e) => updateLine(i, { nom: e.target.value })}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min="0"
                  placeholder="Qté"
                  value={line.quantite}
                  onChange={(e) => updateLine(i, { quantite: e.target.value })}
                />
                <Input
                  className="col-span-3"
                  type="number"
                  min="0"
                  placeholder="Prix unitaire"
                  value={line.prixUnitaire}
                  onChange={(e) => updateLine(i, { prixUnitaire: e.target.value })}
                />
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <span className="truncate text-xs text-muted-foreground">
                    {formatFcfa((Number(line.quantite) || 0) * (Number(line.prixUnitaire) || 0))}
                  </span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
          <span>Total</span>
          <span>{formatFcfa(total)}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Création..." : "Créer la proforma"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
