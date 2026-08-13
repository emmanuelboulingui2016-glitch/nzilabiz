"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { ClientCreance } from "./types";

export function ClientEditDialog({
  open,
  onClose,
  client,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  client: ClientCreance | null;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [limiteCredit, setLimiteCredit] = useState("");
  const [echeanceJours, setEcheanceJours] = useState("");
  const [saving, setSaving] = useState(false);

  // Réinitialise les champs à chaque ouverture pour un client donné.
  const key = client?.id ?? "none";
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setNom(client?.nom ?? "");
    setTelephone(client?.telephone ?? "");
    setLimiteCredit(client?.limiteCredit !== null && client?.limiteCredit !== undefined ? String(client.limiteCredit) : "");
    setEcheanceJours(client?.echeanceJours !== null && client?.echeanceJours !== undefined ? String(client.echeanceJours) : "");
  }

  if (!client) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/creances/clients/${client!.id}`, {
        method: "PATCH",
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
        throw new Error(data.error ?? "Échec de la mise à jour");
      }
      toast.success("Conditions de crédit mises à jour");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Modifier — ${client.nom}`}>
      <div className="space-y-3">
        <div>
          <Label htmlFor="nom">Nom du client</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="telephone">Téléphone</Label>
          <Input id="telephone" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="077123456" />
        </div>
        <div>
          <Label htmlFor="limiteCredit">Limite de crédit (FCFA)</Label>
          <Input
            id="limiteCredit"
            type="number"
            min={0}
            value={limiteCredit}
            onChange={(e) => setLimiteCredit(e.target.value)}
            placeholder="Aucune limite"
          />
        </div>
        <div>
          <Label htmlFor="echeanceJours">Échéance de paiement (jours)</Label>
          <Input
            id="echeanceJours"
            type="number"
            min={0}
            value={echeanceJours}
            onChange={(e) => setEcheanceJours(e.target.value)}
            placeholder={`Défaut boutique (${client.echeanceEffective} j)`}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !nom.trim()}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
