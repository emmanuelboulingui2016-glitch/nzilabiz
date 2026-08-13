"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Truck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { KpiCards } from "@/components/stock/kpi-cards";
import { ProductTable } from "@/components/stock/product-table";
import { ProductFormModal } from "@/components/stock/product-form-modal";
import { ReceptionModal } from "@/components/stock/reception-modal";
import { ImportModal } from "@/components/stock/import-modal";
import type { CategoryRow, ProductRow, StockKpis } from "@/components/stock/stock-utils";

export function StockPageClient({ canEdit, canAdjust }: { canEdit: boolean; canAdjust: boolean }) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [kpis, setKpis] = useState<StockKpis>({ totalProduits: 0, valeurStock: 0, stockFaible: 0, ruptureStock: 0, aPayer: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (categoryId) params.set("categoryId", categoryId);
      if (status) params.set("status", status);
      const res = await fetch(`/api/stock/products?${params.toString()}`);
      if (!res.ok) throw new Error("Échec du chargement");
      const data = await res.json();
      setProducts(data.products ?? []);
      setCategories(data.categories ?? []);
      setKpis(data.kpis ?? { totalProduits: 0, valeurStock: 0, stockFaible: 0, ruptureStock: 0, aPayer: 0 });
    } catch {
      toast.error("Impossible de charger le stock.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, status]);

  const handleDelete = async (product: ProductRow) => {
    if (!confirm(`Supprimer le produit « ${product.nom} » ? Cette action est irréversible.`)) return;
    const res = await fetch(`/api/stock/products/${product.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Échec de la suppression.");
      return;
    }
    toast.success("Produit supprimé.");
    load();
  };

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">Catalogue produits, réceptions et mouvements de stock.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              Importer CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setReceptionOpen(true)}>
              <Truck size={16} />
              Réceptionner une livraison
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={16} />
              Ajouter un produit
            </Button>
          </div>
        )}
      </div>

      <KpiCards kpis={kpis} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Rechercher (nom, référence, code-barres)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:max-w-[180px]">
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:max-w-[180px]">
          <option value="">Tous statuts</option>
          <option value="ok">En stock</option>
          <option value="faible">Stock faible</option>
          <option value="rupture">Rupture</option>
        </Select>
      </div>

      <ProductTable
        products={products}
        loading={loading}
        canEdit={canEdit}
        onRowClick={(p) => router.push(`/stock/${p.id}`)}
        onDelete={canEdit ? handleDelete : undefined}
      />

      {canEdit && (
        <>
          <ProductFormModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            categories={categories}
            onSaved={() => {
              setAddOpen(false);
              load();
            }}
          />
          <ReceptionModal
            open={receptionOpen}
            onClose={() => setReceptionOpen(false)}
            onSaved={() => {
              setReceptionOpen(false);
              load();
            }}
          />
          <ImportModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            onImported={() => {
              setImportOpen(false);
              load();
            }}
          />
        </>
      )}
    </div>
  );
}
