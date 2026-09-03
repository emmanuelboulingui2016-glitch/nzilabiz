"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { parseFcfaInput } from "@/lib/currency";

// §5 Fond de caisse d'ouverture — si aucun comptage OUVERTURE n'existe pour la journée en
// cours, on invite l'utilisateur à le saisir avant d'afficher les chiffres de caisse.
export function CashCountOpeningBanner() {
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
        body: JSON.stringify({ type: "OUVERTURE", montantSaisi: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Impossible d'enregistrer le fond de caisse");
        return;
      }
      toast.success("Fond de caisse d'ouverture enregistré");
      setOpen(false);
      setMontant("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="text-warning" size={20} />
          <div>
            <p className="text-sm font-medium">Fond de caisse d&apos;ouverture non défini</p>
            <p className="text-xs text-muted-foreground">
              Saisissez le montant d&apos;espèces déjà présent dans le tiroir-caisse pour un calcul fiable du « Reste en caisse ».
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Définir le fond de caisse
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Fond de caisse d'ouverture">
        <div className="space-y-4">
          <div>
            <Label htmlFor="fond-ouverture">Espèces déjà présentes dans le tiroir-caisse (FCFA)</Label>
            <Input
              id="fond-ouverture"
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
