"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Pencil, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { formatFcfa } from "@/lib/currency";
import { StatusBadge } from "@/components/stock/status-badge";
import { ProductFormModal } from "@/components/stock/product-form-modal";
import { AdjustmentModal } from "@/components/stock/adjustment-modal";
import {
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_TONES,
  toNumber,
  type CategoryRow,
  type MovementRow,
  type ProductRow,
} from "@/components/stock/stock-utils";
import { Badge } from "@/components/ui/badge";

export function ProductDetailClient({ productId, canEdit, canAdjust }: { productId: string; canEdit: boolean; canAdjust: boolean }) {
  const router = useRouter();
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("infos");
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, listRes] = await Promise.all([
        fetch(`/api/stock/products/${productId}`),
        fetch("/api/stock/products"),
      ]);
      if (!detailRes.ok) {
        toast.error("Produit introuvable.");
        return;
      }
      const detail = await detailRes.json();
      setProduct(detail.product);
      setMovements(detail.movements ?? []);
      if (listRes.ok) {
        const list = await listRes.json();
        setCategories(list.categories ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !product) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/stock")} aria-label="Retour">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{product.nom}</h1>
            <p className="font-mono text-xs text-muted-foreground">{product.reference}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canAdjust && (
            <Button variant="outline" size="sm" onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal size={16} />
              Ajuster le stock
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setEditOpen(true)}>
              <Pencil size={16} />
              Modifier
            </Button>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { value: "infos", label: "Informations" },
          { value: "mouvements", label: "Mouvements" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "infos" && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Statut"><StatusBadge statut={product.statut} /></Field>
            <Field label="Catégorie">{product.categoryNom ?? "—"}</Field>
            <Field label="Code-barres">{product.codeBarres ?? "—"}</Field>
            <Field label="Date de péremption">
              {product.datePeremption ? new Date(product.datePeremption).toLocaleDateString("fr-FR") : "—"}
            </Field>
            <Field label="Prix d'achat">{formatFcfa(product.prixAchat)}</Field>
            <Field label="Prix de vente">{formatFcfa(product.prixVente)}</Field>
            <Field label="Prix de gros">{product.prixGros ? formatFcfa(product.prixGros) : "—"}</Field>
            <Field label="Unité">{product.unite}</Field>
            <Field label="Stock actuel">
              {toNumber(product.quantiteStock)} {product.unite}
            </Field>
            <Field label="Seuil d'alerte">{toNumber(product.seuilAlerte)}</Field>
          </CardContent>
        </Card>
      )}

      {tab === "mouvements" && (
        <Card>
          <CardContent className="p-0">
            {movements.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Aucun mouvement enregistré pour ce produit.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium text-right">Quantité</th>
                      <th className="px-4 py-2.5 font-medium">Motif</th>
                      <th className="px-4 py-2.5 font-medium">Utilisateur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const qty = toNumber(m.quantite);
                      return (
                        <tr key={m.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {new Date(m.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone={MOVEMENT_TYPE_TONES[m.type] ?? "neutral"}>{MOVEMENT_TYPE_LABELS[m.type] ?? m.type}</Badge>
                          </td>
                          <td className={`px-4 py-2.5 text-right font-medium ${qty >= 0 ? "text-success" : "text-danger"}`}>
                            {qty >= 0 ? `+${qty}` : qty}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{m.motif ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{m.userNom ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <ProductFormModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          categories={categories}
          product={product}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}

      {canAdjust && (
        <AdjustmentModal
          open={adjustOpen}
          onClose={() => setAdjustOpen(false)}
          productId={product.id}
          productNom={product.nom}
          quantiteActuelle={toNumber(product.quantiteStock)}
          onSaved={() => {
            setAdjustOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  );
}
