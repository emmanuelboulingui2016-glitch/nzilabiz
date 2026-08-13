"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function NewClientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [limiteCredit, setLimiteCredit] = useState("");
  const [echeanceJours, setEcheanceJours] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNom("");
    setTelephone("");
    setLimiteCredit("");
    setEcheanceJours("");
  }

  async function handleCreate() {
    if (!nom.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/creances/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          telephone: telephone || null,
          limiteCredit: limiteCredit === "" ? null : Number(limiteCredit),
          echeanceJours: echeanceJours === "" ? null : Number(echeanceJours),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Échec de la création");
      }
      toast.success("Client créé");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nouveau client">
      <div className="space-y-3">
        <div>
          <Label htmlFor="new-nom">Nom du client</Label>
          <Input id="new-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
        </div>
        <div>
          <Label htmlFor="new-telephone">Téléphone</Label>
          <Input id="new-telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="077123456" />
        </div>
        <div>
          <Label htmlFor="new-limite">Limite de crédit (FCFA)</Label>
          <Input
            id="new-limite"
            type="number"
            min={0}
            value={limiteCredit}
            onChange={(e) => setLimiteCredit(e.target.value)}
            placeholder="Aucune limite"
          />
        </div>
        <div>
          <Label htmlFor="new-echeance">Échéance de paiement (jours)</Label>
          <Input
            id="new-echeance"
            type="number"
            min={0}
            value={echeanceJours}
            onChange={(e) => setEcheanceJours(e.target.value)}
            placeholder="Défaut boutique"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={saving || !nom.trim()}>
            {saving ? "Création..." : "Créer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
