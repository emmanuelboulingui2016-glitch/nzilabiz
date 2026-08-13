"use client";

import { Printer, Share2 } from "lucide-react";
import { formatFcfa } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReceiptData } from "./types";

const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT: "Crédit",
};

function buildWhatsappText(receipt: ReceiptData) {
  const lines = [
    `Reçu ${receipt.numero} — ${receipt.storeName}`,
    new Date(receipt.dateHeure).toLocaleString("fr-FR"),
    "",
    ...receipt.items.map((item) => `${item.nom} x${item.quantite} = ${formatFcfa(item.sousTotal)}`),
    "",
    `Total : ${formatFcfa(receipt.total)}`,
    "Merci de votre achat !",
  ];
  return lines.join("\n");
}

export function ReceiptView({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const especes = receipt.payments.find((p) => p.mode === "ESPECES" && p.montantRecu != null);
  const monnaie = especes && especes.montantRecu != null ? especes.montantRecu - especes.montant : null;
  const whatsappText = buildWhatsappText(receipt);

  return (
    <div className="space-y-4">
      {/* Styles d'impression : seul le reçu est visible sur la page imprimée (window.print()). */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #nzilabiz-receipt, #nzilabiz-receipt * { visibility: visible; }
          #nzilabiz-receipt { position: fixed; inset: 0; width: 100%; padding: 16px; }
        }
      `}</style>

      {receipt.pending && (
        <Badge tone="warning" className="w-full justify-center py-1.5">
          Vente enregistrée hors-ligne — en attente de synchronisation
        </Badge>
      )}

      <div id="nzilabiz-receipt" className="rounded-lg border border-dashed border-border p-4 text-sm">
        <div className="mb-2 text-center">
          <p className="font-semibold">{receipt.storeName}</p>
          <p className="text-muted-foreground">Reçu {receipt.numero}</p>
          <p className="text-muted-foreground">{new Date(receipt.dateHeure).toLocaleString("fr-FR")}</p>
          {receipt.clientNom && <p className="text-muted-foreground">Client : {receipt.clientNom}</p>}
        </div>
        <div className="my-2 border-t border-dashed border-border" />
        <div className="space-y-1">
          {receipt.items.map((item, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="flex-1">
                {item.nom} × {item.quantite}
              </span>
              <span>{formatFcfa(item.sousTotal)}</span>
            </div>
          ))}
        </div>
        <div className="my-2 border-t border-dashed border-border" />
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span>{formatFcfa(receipt.sousTotal)}</span>
          </div>
          {receipt.remise > 0 && (
            <div className="flex justify-between">
              <span>Remise</span>
              <span>-{formatFcfa(receipt.remise)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatFcfa(receipt.total)}</span>
          </div>
        </div>
        <div className="my-2 border-t border-dashed border-border" />
        <div className="space-y-1">
          {receipt.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{MODE_LABEL[p.mode]}</span>
              <span>{formatFcfa(p.montant)}</span>
            </div>
          ))}
          {especes && monnaie != null && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Montant reçu</span>
                <span>{formatFcfa(especes.montantRecu ?? 0)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Monnaie rendue</span>
                <span>{formatFcfa(Math.max(0, monnaie))}</span>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">Merci de votre achat !</p>
      </div>

      <div className="grid grid-cols-2 gap-2 print:hidden">
        <Button type="button" variant="outline" size="lg" onClick={() => window.print()} className="gap-2">
          <Printer size={18} /> Imprimer le reçu
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-base font-medium text-white hover:opacity-90"
        >
          <Share2 size={18} /> Partager WhatsApp
        </a>
      </div>
      <Button type="button" variant="ghost" className="w-full print:hidden" onClick={onClose}>
        Nouvelle vente
      </Button>
    </div>
  );
}
