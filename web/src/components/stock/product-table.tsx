"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/currency";
import { StatusBadge } from "@/components/stock/status-badge";
import { toNumber, type ProductRow } from "@/components/stock/stock-utils";

export function ProductTable({
  products,
  loading,
  canEdit,
  onRowClick,
  onDelete,
}: {
  products: ProductRow[];
  loading: boolean;
  canEdit: boolean;
  onRowClick: (product: ProductRow) => void;
  onDelete?: (product: ProductRow) => void;
}) {
  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Chargement…</div>;
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Aucun produit ne correspond à ces filtres.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">Réf.</th>
            <th className="px-3 py-2.5 font-medium">Produit</th>
            <th className="px-3 py-2.5 font-medium">Catégorie</th>
            <th className="px-3 py-2.5 font-medium text-right">Prix achat</th>
            <th className="px-3 py-2.5 font-medium text-right">Prix vente</th>
            <th className="px-3 py-2.5 font-medium text-right">Stock</th>
            <th className="px-3 py-2.5 font-medium text-right">Seuil</th>
            <th className="px-3 py-2.5 font-medium">Statut</th>
            <th className="px-3 py-2.5 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr
              key={p.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/60"
              onClick={() => onRowClick(p)}
            >
              <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.reference}</td>
              <td className="px-3 py-2.5 font-medium">
                <div className="flex items-center gap-2">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-muted" />
                  )}
                  <span>{p.nom}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{p.categoryNom ?? "—"}</td>
              <td className="px-3 py-2.5 text-right">{formatFcfa(p.prixAchat)}</td>
              <td className="px-3 py-2.5 text-right">{formatFcfa(p.prixVente)}</td>
              <td className="px-3 py-2.5 text-right">
                {toNumber(p.quantiteStock)} {p.unite}
              </td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{toNumber(p.seuilAlerte)}</td>
              <td className="px-3 py-2.5">
                <StatusBadge statut={p.statut} />
              </td>
              <td className="px-3 py-2.5 text-right">
                {canEdit && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(p);
                    }}
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} className="text-danger" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
