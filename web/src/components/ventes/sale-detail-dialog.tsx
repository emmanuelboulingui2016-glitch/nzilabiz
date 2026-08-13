"use client";

// Dialog "Voir" une vente — détail des articles/paiements + impression du reçu (§7, Actions :
// voir/imprimer reçu). L'impression utilise une zone dédiée (.print-receipt) rendue visible via
// des styles @media print pendant que le dialog est ouvert.

import { Printer } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/currency";
import { PAIEMENT_LABELS, type SaleRow } from "./types";

export function SaleDetailDialog({ sale, onClose }: { sale: SaleRow; onClose: () => void }) {
  const dt = new Date(sale.dateHeure);

  return (
    <Dialog open onClose={onClose} title={`Vente ${sale.numero}`}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-receipt, .print-receipt * { visibility: visible; }
          .print-receipt { position: absolute; top: 0; left: 0; width: 100%; padding: 16px; }
        }
      `}</style>
      <div className="print-receipt space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {dt.toLocaleDateString("fr-FR")} à {dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {sale.clientNom && <p className="text-sm">Client : {sale.clientNom}</p>}
            {sale.vendeurNom && <p className="text-xs text-muted-foreground">Vendeur : {sale.vendeurNom}</p>}
          </div>
          <Badge tone={sale.statut === "ANNULEE" ? "danger" : "success"}>
            {sale.statut === "ANNULEE" ? "Annulée" : "Validée"}
          </Badge>
        </div>

        {sale.statut === "ANNULEE" && sale.motifAnnulation && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            Motif d&apos;annulation : {sale.motifAnnulation}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">PU</th>
                <th className="px-3 py-2 text-right">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3 py-2">{it.productNom}</td>
                  <td className="px-3 py-2 text-right">{it.quantite}</td>
                  <td className="px-3 py-2 text-right">{formatFcfa(it.prixUnitaire)}</td>
                  <td className="px-3 py-2 text-right">{formatFcfa(it.sousTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1 text-right text-sm">
          <p className="text-lg font-bold">Total : {formatFcfa(sale.total)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Paiement(s)</p>
          {sale.payments.map((p, i) => (
            <p key={i} className="text-sm">
              {PAIEMENT_LABELS[p.mode]} — {formatFcfa(p.montant)}
            </p>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={16} />
            Imprimer le reçu
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
