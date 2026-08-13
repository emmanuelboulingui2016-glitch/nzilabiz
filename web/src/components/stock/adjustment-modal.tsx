"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { MOTIF_AJUSTEMENT_OPTIONS } from "@/components/stock/stock-utils";

export function AdjustmentModal({
  open,
  onClose,
  productId,
  productNom,
  quantiteActuelle,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productNom: string;
  quantiteActuelle: number;
  onSaved: () => void;
}) {
  const [sens, setSens] = useState<"plus" | "moins">("moins");
  const [quantite, setQuantite] = useState("");
  const [motifType, setMotifType] = useState(MOTIF_AJUSTEMENT_OPTIONS[0].value);
  const [motifDetail, setMotifDetail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSens("moins");
    setQuantite("");
    setMotifType(MOTIF_AJUSTEMENT_OPTIONS[0].value);
    setMotifDetail("");
  }, [open]);

  const handleSubmit = async () => {
    const q = Number(quantite);
    if (!q || q <= 0) {
      toast.error("Indiquez une quantité positive.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/stock/ajustement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantite: sens === "moins" ? -q : q,
          motifType,
          motifDetail: motifDetail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'ajustement.");
        return;
      }
      toast.success("Stock ajusté.");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Ajustement manuel de stock" className="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {productNom} — stock actuel : <span className="font-medium text-foreground">{quantiteActuelle}</span>
        </p>

        <div>
          <Label>Sens de l&apos;ajustement</Label>
          <div className="flex gap-2">
            <Button type="button" variant={sens === "moins" ? "primary" : "outline"} size="sm" onClick={() => setSens("moins")}>
              Diminuer (−)
            </Button>
            <Button type="button" variant={sens === "plus" ? "primary" : "outline"} size="sm" onClick={() => setSens("plus")}>
              Augmenter (+)
            </Button>
          </div>
        </div>

        <div>
          <Label>Quantité</Label>
          <Input type="number" min="0" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </div>

        <div>
          <Label>Motif *</Label>
          <Select value={motifType} onChange={(e) => setMotifType(e.target.value)}>
            {MOTIF_AJUSTEMENT_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Détail (optionnel)</Label>
          <Textarea value={motifDetail} onChange={(e) => setMotifDetail(e.target.value)} placeholder="Précisions…" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement…" : "Ajuster le stock"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
