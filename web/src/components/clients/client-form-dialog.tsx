"use client";

// Création et modification d'une fiche client. Le même formulaire sert aux deux cas : quand
// `client` est fourni on fait un PATCH, sinon un POST.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { ClientFiche } from "./types";

export function ClientFormDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientFiche | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");
  const [notes, setNotes] = useState("");
  const [limiteCredit, setLimiteCredit] = useState("");
  const [echeanceJours, setEcheanceJours] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNom(client?.nom ?? "");
    setTelephone(client?.telephone ?? "");
    setEmail(client?.email ?? "");
    setAdresse(client?.adresse ?? "");
    setNotes(client?.notes ?? "");
    setLimiteCredit(client?.limiteCredit != null ? String(client.limiteCredit) : "");
    setEcheanceJours(client?.echeanceJours != null ? String(client.echeanceJours) : "");
  }, [open, client]);

  async function handleSave() {
    if (!nom.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nom,
        telephone: telephone || null,
        email: email || null,
        adresse: adresse || null,
        notes: notes || null,
        limiteCredit: limiteCredit === "" ? null : Number(limiteCredit),
        echeanceJours: echeanceJours === "" ? null : Number(echeanceJours),
      };
      const res = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Échec de l'enregistrement");
      }
      toast.success(client ? "Fiche client mise à jour" : "Client créé");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={client ? "Modifier le client" : "Nouveau client"}>
      <div className="space-y-3">
        <div>
          <Label htmlFor="client-nom">Nom du client</Label>
          <Input id="client-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="client-tel">Téléphone</Label>
            <Input
              id="client-tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="077123456"
            />
          </div>
          <div>
            <Label htmlFor="client-email">E-mail (optionnel)</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@exemple.com"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="client-adresse">Adresse / quartier (optionnel)</Label>
          <Input
            id="client-adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Nzeng-Ayong, derrière le marché"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="client-limite">Limite de crédit (FCFA)</Label>
            <Input
              id="client-limite"
              type="number"
              min={0}
              value={limiteCredit}
              onChange={(e) => setLimiteCredit(e.target.value)}
              placeholder="Aucune limite"
            />
          </div>
          <div>
            <Label htmlFor="client-echeance">Échéance de paiement (jours)</Label>
            <Input
              id="client-echeance"
              type="number"
              min={0}
              value={echeanceJours}
              onChange={(e) => setEcheanceJours(e.target.value)}
              placeholder="Défaut boutique"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="client-notes">Notes (optionnel)</Label>
          <Textarea
            id="client-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Préfère passer le samedi matin, achète toujours du riz en sac de 25 kg…"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !nom.trim()}>
            {saving ? "Enregistrement..." : client ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
