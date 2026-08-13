"use client";

import { Package } from "lucide-react";
import { formatFcfa } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { VendreProduct } from "./types";

export function ProductCard({ product, onAdd }: { product: VendreProduct; onAdd: (product: VendreProduct) => void }) {
  const stock = Number(product.quantiteStock);
  const seuil = Number(product.seuilAlerte);
  const ruptureStock = stock <= 0;

  return (
    <button
      type="button"
      onClick={() => !ruptureStock && onAdd(product)}
      disabled={ruptureStock}
      className={cn(
        "flex min-h-[136px] flex-col items-stretch gap-1 rounded-xl border border-border bg-card p-2 text-left shadow-sm transition-transform active:scale-95 disabled:opacity-40"
      )}
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
        {product.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.photoUrl} alt={product.nom} className="h-full w-full object-cover" />
        ) : (
          <Package className="text-muted-foreground" size={28} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-0.5 pb-0.5">
        <span className="line-clamp-2 text-sm font-medium leading-tight">{product.nom}</span>
        <span className="text-sm font-semibold text-primary">{formatFcfa(product.prixVente)}</span>
        <span
          className={cn(
            "text-xs",
            ruptureStock ? "text-danger" : stock <= seuil ? "text-warning" : "text-muted-foreground"
          )}
        >
          {ruptureStock ? "Rupture de stock" : `Stock : ${stock} ${product.unite}`}
        </span>
      </div>
    </button>
  );
}
