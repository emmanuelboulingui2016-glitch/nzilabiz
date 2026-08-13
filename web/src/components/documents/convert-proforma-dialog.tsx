"use client";

// « Transformer en vente » (§12 🔧 Amélioration) : étape de mapping explicite entre chaque ligne
// brouillon de la Proforma et un vrai Product du catalogue (obligatoire, cf. commentaire détaillé
// dans /api/documents/[id]/convertir/route.ts). Pré-sélectionne automatiquement le produit dont le
// nom correspond exactement (insensible à la casse) au nom saisi sur la ligne brouillon, sinon
// laisse le champ vide pour forcer un choix explicite de l'utilisateur.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import type { DocumentDetail, ProductOption } from "./types";

type MappedLine = { productId: string; quantite: string; prixUnitaire: string };

const MODE_OPTIONS = [
  { value: "ESPECES", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CREDIT", label: "Crédit" },
];

export function ConvertProformaDialog({
  documentId,
  onClose,
  onConverted,
}: {
  documentId: string | null;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [produits, setProduits] = useState<ProductOption[]>([]);
  const [lignes, setLignes] = useState<MappedLine[]>([]);
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setProduits([]);
      setLignes([]);
      return;
    }
    setLoading(true);
    fetch(`/api/documents/${documentId}`)
      .then((res) => res.json())
      .then((data) => {
        const detail: DocumentDetail = data.document;
        const options: ProductOption[] = data.produitsDisponibles ?? [];
        setDoc(detail);
        setProduits(options);
        const draft = detail.itemsBrouillon ?? [];
        setLignes(
          draft.map((d) => {
            const match = options.find((p) => p.nom.trim().toLowerCase() === d.nom.trim().toLowerCase());
            return {
              productId: match?.id ?? "",
              quantite: String(d.quantite),
              prixUnitaire: String(d.prixUnitaire),
            };
          })
        );
      })
      .catch(() => toast.error("Impossible de charger la proforma"))
      .finally(() => setLoading(false));
  }, [documentId]);

  const total = useMemo(
    () => lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0),
    [lignes]
  );

  function updateLigne(index: number, patch: Partial<MappedLine>) {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSubmit() {
    if (!documentId) return;
    if (lignes.some((l) => !l.productId)) {
      toast.error("Associez chaque ligne à un produit du catalogue avant de continuer.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/convertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modePaiement,
          lignes: lignes.map((l) => ({
            productId: l.productId,
            quantite: Number(l.quantite),
            prixUnitaire: Number(l.prixUnitaire),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la conversion");
      toast.success(`Vente ${data.sale.numero} et facture ${data.facture.numero} créées`);
      onConverted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  }

  if (!documentId) return null;

  return (
    <Dialog open={!!documentId} onClose={onClose} title="Transformer la proforma en vente" className="max-w-xl">
      {loading || !doc ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Associez chaque ligne de la proforma à un produit existant du catalogue (obligatoire pour créer une
            vente réelle), ajustez si besoin la quantité et le prix, puis confirmez le mode de paiement reçu.
          </p>

          {produits.length === 0 ? (
            <p className="text-sm text-warning">
              Aucun produit trouvé dans votre catalogue. Ajoutez d&apos;abord les produits concernés dans le module
              Stock avant de convertir cette proforma.
            </p>
          ) : null}

          <div className="space-y-2">
            {(doc.itemsBrouillon ?? []).map((d, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-medium">
                  {d.nom} — proforma : {d.quantite} × {formatFcfa(d.prixUnitaire)}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    className="col-span-3"
                    value={lignes[i]?.productId ?? ""}
                    onChange={(e) => updateLigne(i, { productId: e.target.value })}
                  >
                    <option value="">Associer un produit...</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    value={lignes[i]?.quantite ?? ""}
                    onChange={(e) => updateLigne(i, { quantite: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="0"
                    className="col-span-2"
                    value={lignes[i]?.prixUnitaire ?? ""}
                    onChange={(e) => updateLigne(i, { prixUnitaire: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label>Mode de paiement reçu</Label>
            <Select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
              {MODE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
            <span>Total à encaisser</span>
            <span>{formatFcfa(total)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || produits.length === 0}>
              {submitting ? "Conversion..." : "Confirmer et créer la vente"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
