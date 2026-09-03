"use client";

// Dialog d'annulation d'une vente — §7 "motif obligatoire pour toute annulation".
// Sélection d'un motif prédéfini (+ champ libre si "autre"), puis appel à
// POST /api/ventes/[id]/annuler. Le comportement (annulation immédiate ou demande d'approbation)
// est décidé côté serveur selon la permission de l'utilisateur.

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { MOTIF_OPTIONS, type SaleRow } from "./types";

export function AnnulerDialog({
  sale,
  canDirect,
  onClose,
  onDone,
}: {
  sale: SaleRow;
  canDirect: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [motifType, setMotifType] = useState("erreur_saisie");
  const [motifTexte, setMotifTexte] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requiresTexte = motifType === "autre";

  const submit = async () => {
    if (requiresTexte && motifTexte.trim().length === 0) {
      toast.error("Merci de préciser le motif.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ventes/${sale.id}/annuler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motifType, motifTexte }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Impossible d'annuler cette vente.");
        return;
      }
      if (data.mode === "annulee") {
        toast.success(`Vente ${sale.numero} annulée.`);
      } else {
        toast.success(data.message ?? "Demande envoyée, en attente de validation.");
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Annuler la vente ${sale.numero}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {canDirect
            ? "L'annulation sera appliquée immédiatement : le stock sera réajusté et un mouvement de stock sera enregistré."
            : "Votre demande sera envoyée au Patron ou au Gérant pour validation. La vente restera active jusqu'à décision."}
        </p>

        <div>
          <Label htmlFor="motif-annulation">Motif de l&apos;annulation</Label>
          <Select id="motif-annulation" value={motifType} onChange={(e) => setMotifType(e.target.value)}>
            {MOTIF_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {requiresTexte && (
          <div>
            <Label htmlFor="motif-texte">Précisez le motif</Label>
            <Textarea
              id="motif-texte"
              value={motifTexte}
              onChange={(e) => setMotifTexte(e.target.value)}
              placeholder="Décrivez la raison de l'annulation"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Retour
          </Button>
          <Button variant="danger" onClick={submit} disabled={submitting}>
            {submitting ? "Envoi..." : canDirect ? "Annuler la vente" : "Envoyer la demande"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
