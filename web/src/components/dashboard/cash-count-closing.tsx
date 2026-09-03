"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFcfa, parseFcfaInput } from "@/lib/currency";
import type { CashCountSummary } from "./types";

// §5 Comptage de caisse de fermeture (optionnel) — écart = montant compté − montant théorique.
export function CashCountClosingWidget({
  resteEnCaisse,
  cashCountFermeture,
}: {
  resteEnCaisse: number;
  cashCountFermeture: CashCountSummary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [montant, setMontant] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const value = parseFcfaInput(montant);
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/cash-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "FERMETURE", montantSaisi: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Impossible d'enregistrer le comptage");
        return;
      }
      toast.success("Comptage de caisse enregistré");
      setOpen(false);
      setMontant("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const ecart = cashCountFermeture?.ecart ?? null;
  const ecartTone = ecart === null ? "neutral" : ecart === 0 ? "success" : ecart > 0 ? "info" : "danger";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ClipboardCheck size={16} className="text-primary" />
            Comptage de caisse (fermeture)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cashCountFermeture ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Compté</span>
                <span className="font-medium">{formatFcfa(cashCountFermeture.montantSaisi)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Théorique</span>
                <span className="font-medium">{formatFcfa(cashCountFermeture.montantTheorique ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Écart</span>
                <Badge tone={ecartTone as "neutral" | "success" | "info" | "danger"}>
                  {ecart !== null && ecart > 0 ? "+" : ""}
                  {formatFcfa(ecart ?? 0)}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Comptez physiquement la caisse en fin de journée pour repérer tout écart avec le solde théorique
              ({formatFcfa(resteEnCaisse)} actuellement).
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {cashCountFermeture ? "Recompter la caisse" : "Compter la caisse"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="Comptage de caisse — fermeture">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Solde théorique actuel : <span className="font-medium text-foreground">{formatFcfa(resteEnCaisse)}</span>
          </p>
          <div>
            <Label htmlFor="fermeture-montant">Montant compté physiquement (FCFA)</Label>
            <Input
              id="fermeture-montant"
              type="number"
              min={0}
              inputMode="numeric"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={submitting || montant === ""}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
