"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import { MODE_REGLEMENT_OPTIONS, type ProductRow } from "@/components/stock/stock-utils";

type Ligne = { productId: string; quantite: string; prixAchat: string };

const emptyLigne = (): Ligne => ({ productId: "", quantite: "", prixAchat: "" });

export function ReceptionModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [fournisseur, setFournisseur] = useState("");
  const [modeReglement, setModeReglement] = useState("ESPECES");
  const [lignes, setLignes] = useState<Ligne[]>([emptyLigne()]);
  const [montantTotal, setMontantTotal] = useState("");
  const [montantTouched, setMontantTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFournisseur("");
    setModeReglement("ESPECES");
    setLignes([emptyLigne()]);
    setMontantTotal("");
    setMontantTouched(false);
    setLoadingProducts(true);
    fetch("/api/stock/products")
      .then((r) => r.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => toast.error("Impossible de charger la liste des produits."))
      .finally(() => setLoadingProducts(false));
  }, [open]);

  const computedTotal = useMemo(
    () => lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prixAchat) || 0), 0),
    [lignes]
  );

  useEffect(() => {
    if (!montantTouched) setMontantTotal(computedTotal ? String(computedTotal) : "");
  }, [computedTotal, montantTouched]);

  const updateLigne = (i: number, patch: Partial<Ligne>) => {
    setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const removeLigne = (i: number) => setLignes((prev) => prev.filter((_, idx) => idx !== i));

  const handleProductPick = (i: number, productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    updateLigne(i, { productId, prixAchat: p ? p.prixAchat : "" });
  };

  const handleSubmit = async () => {
    if (!fournisseur.trim()) {
      toast.error("Le fournisseur est requis.");
      return;
    }
    const validLignes = lignes.filter((l) => l.productId && Number(l.quantite) > 0);
    if (validLignes.length === 0) {
      toast.error("Ajoutez au moins une ligne avec un produit et une quantité.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/stock/receptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseur: fournisseur.trim(),
          modeReglement,
          lignes: validLignes.map((l) => ({
            productId: l.productId,
            quantite: Number(l.quantite),
            prixAchat: Number(l.prixAchat) || 0,
          })),
          montantTotal: montantTotal ? Number(montantTotal) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Échec de la réception.");
        return;
      }
      toast.success("Livraison réceptionnée : stock mis à jour et dépense « Rachats de stock » créée.");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Réceptionner une livraison" className="max-w-2xl">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Cette action met à jour le stock des produits reçus et crée automatiquement la dépense « Rachats de stock »
          correspondante — une seule saisie pour les deux.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fournisseur *</Label>
            <Input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} placeholder="Nom du fournisseur" />
          </div>
          <div>
            <Label>Mode de règlement</Label>
            <Select value={modeReglement} onChange={(e) => setModeReglement(e.target.value)}>
              {MODE_REGLEMENT_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Produits reçus</Label>
          {lignes.map((l, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  value={l.productId}
                  onChange={(e) => handleProductPick(i, e.target.value)}
                  disabled={loadingProducts}
                >
                  <option value="">{loadingProducts ? "Chargement…" : "Sélectionner un produit"}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} ({p.reference})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-24">
                <Input
                  type="number"
                  min="0"
                  placeholder="Qté"
                  value={l.quantite}
                  onChange={(e) => updateLigne(i, { quantite: e.target.value })}
                />
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  min="0"
                  placeholder="Prix achat"
                  value={l.prixAchat}
                  onChange={(e) => updateLigne(i, { prixAchat: e.target.value })}
                />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLigne(i)} disabled={lignes.length === 1}>
                <Trash2 size={16} className="text-danger" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setLignes((prev) => [...prev, emptyLigne()])}>
            <Plus size={14} />
            Ajouter une ligne
          </Button>
        </div>

        <div className="flex items-end justify-between gap-3 rounded-lg bg-muted/60 p-3">
          <div>
            <Label>Montant total de la livraison</Label>
            <Input
              type="number"
              min="0"
              value={montantTotal}
              onChange={(e) => {
                setMontantTouched(true);
                setMontantTotal(e.target.value);
              }}
              className="w-40"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Suggéré depuis les lignes : {formatFcfa(computedTotal)}. Modifiable (frais de transport, remise…).
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement…" : "Réceptionner la livraison"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
