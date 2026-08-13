"use client";

import { useMemo } from "react";
import { Camera, ScanLine, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { ProductCard } from "./product-card";
import type { VendreCategory, VendreProduct } from "./types";

export function ProductGrid({
  products,
  categories,
  loading,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  barcode,
  onBarcodeChange,
  onBarcodeSubmit,
  onScanClick,
  onAddProduct,
}: {
  products: VendreProduct[];
  categories: VendreCategory[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  barcode: string;
  onBarcodeChange: (value: string) => void;
  onBarcodeSubmit: () => void;
  onScanClick: () => void;
  onAddProduct: (product: VendreProduct) => void;
}) {
  const tabs = useMemo(
    () => [{ value: "TOUS", label: "Tous" }, ...categories.map((c) => ({ value: c.id, label: c.nom }))],
    [categories]
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un produit…"
            className="h-11 pl-9"
          />
        </div>
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            value={barcode}
            onChange={(e) => onBarcodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onBarcodeSubmit();
              }
            }}
            placeholder="Scanner ou saisir un code-barres…"
            className="h-11 pl-9 pr-11"
          />
          <button
            type="button"
            onClick={onScanClick}
            aria-label="Scanner avec la caméra"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
          >
            <Camera size={18} />
          </button>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <Tabs tabs={tabs} value={categoryId} onChange={onCategoryChange} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[136px] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun produit trouvé.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={onAddProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
