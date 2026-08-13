"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { CategoryRow, ProductRow } from "@/components/stock/stock-utils";

type FormState = {
  nom: string;
  categoryId: string;
  newCategory: string;
  codeBarres: string;
  datePeremption: string;
  prixAchat: string;
  prixVente: string;
  prixGros: string;
  unite: string;
  quantiteInitiale: string;
  seuilAlerte: string;
  photoUrl: string;
};

const EMPTY: FormState = {
  nom: "",
  categoryId: "",
  newCategory: "",
  codeBarres: "",
  datePeremption: "",
  prixAchat: "",
  prixVente: "",
  prixGros: "",
  unite: "unité",
  quantiteInitiale: "0",
  seuilAlerte: "5",
  photoUrl: "",
};

export function ProductFormModal({
  open,
  onClose,
  categories,
  product,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryRow[];
  product?: ProductRow;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        nom: product.nom,
        categoryId: product.categoryId ?? "",
        newCategory: "",
        codeBarres: product.codeBarres ?? "",
        datePeremption: product.datePeremption ? product.datePeremption.slice(0, 10) : "",
        prixAchat: product.prixAchat,
        prixVente: product.prixVente,
        prixGros: product.prixGros ?? "",
        unite: product.unite,
        quantiteInitiale: "0",
        seuilAlerte: product.seuilAlerte,
        photoUrl: product.photoUrl ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setAddingCategory(false);
  }, [open, product]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handlePhotoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("photoUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.nom.trim()) {
      toast.error("Le nom du produit est requis.");
      return;
    }
    if (!form.prixAchat || !form.prixVente) {
      toast.error("Le prix d'achat et le prix de vente sont requis.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nom: form.nom.trim(),
        codeBarres: form.codeBarres.trim() || null,
        datePeremption: form.datePeremption || null,
        prixAchat: Number(form.prixAchat),
        prixVente: Number(form.prixVente),
        prixGros: form.prixGros ? Number(form.prixGros) : null,
        unite: form.unite.trim() || "unité",
        seuilAlerte: Number(form.seuilAlerte || 5),
        photoUrl: form.photoUrl || null,
      };
      if (form.newCategory.trim()) {
        payload.categoryNom = form.newCategory.trim();
      } else {
        payload.categoryId = form.categoryId || null;
      }

      let res: Response;
      if (isEdit && product) {
        res = await fetch(`/api/stock/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        payload.quantiteInitiale = Number(form.quantiteInitiale || 0);
        res = await fetch("/api/stock/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success(isEdit ? "Produit mis à jour." : "Produit ajouté.");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Modifier le produit" : "Ajouter un produit"} className="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {form.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted" />
          )}
          <div className="flex-1 space-y-2">
            <div>
              <Label>URL de la photo (optionnel)</Label>
              <Input
                value={form.photoUrl.startsWith("data:") ? "" : form.photoUrl}
                onChange={(e) => set("photoUrl", e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div>
              <Label>Ou importer une image</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Nom *</Label>
          <Input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Ex. Riz 5kg" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Catégorie</Label>
            {!addingCategory ? (
              <div className="flex gap-2">
                <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="flex-1">
                  <option value="">Aucune</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => setAddingCategory(true)}>
                  + Nouvelle
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={form.newCategory}
                  onChange={(e) => set("newCategory", e.target.value)}
                  placeholder="Nom de la catégorie"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddingCategory(false);
                    set("newCategory", "");
                  }}
                >
                  Annuler
                </Button>
              </div>
            )}
          </div>
          <div>
            <Label>Code-barres</Label>
            <Input value={form.codeBarres} onChange={(e) => set("codeBarres", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date de péremption (optionnel)</Label>
            <Input type="date" value={form.datePeremption} onChange={(e) => set("datePeremption", e.target.value)} />
          </div>
          <div>
            <Label>Unité</Label>
            <Input value={form.unite} onChange={(e) => set("unite", e.target.value)} placeholder="unité, kg, litre…" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Prix d&apos;achat *</Label>
            <Input type="number" min="0" value={form.prixAchat} onChange={(e) => set("prixAchat", e.target.value)} />
          </div>
          <div>
            <Label>Prix de vente *</Label>
            <Input type="number" min="0" value={form.prixVente} onChange={(e) => set("prixVente", e.target.value)} />
          </div>
          <div>
            <Label>Prix de gros (optionnel)</Label>
            <Input type="number" min="0" value={form.prixGros} onChange={(e) => set("prixGros", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div>
              <Label>Quantité initiale</Label>
              <Input type="number" min="0" value={form.quantiteInitiale} onChange={(e) => set("quantiteInitiale", e.target.value)} />
            </div>
          )}
          <div>
            <Label>Seuil d&apos;alerte</Label>
            <Input type="number" min="0" value={form.seuilAlerte} onChange={(e) => set("seuilAlerte", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter le produit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
