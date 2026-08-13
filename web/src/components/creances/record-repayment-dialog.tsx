"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import type { ClientCreance, CreanceVente } from "./types";

export function RecordRepaymentDialog({
  open,
  onClose,
  clients,
  defaultClientId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientCreance[];
  defaultClientId?: string | null;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<"ESPECES" | "MOBILE_MONEY">("ESPECES");
  const [saleId, setSaleId] = useState("");
  const [ventes, setVentes] = useState<CreanceVente[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? clients[0]?.id ?? "");
      setMontant("");
      setMode("ESPECES");
      setSaleId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultClientId]);

  useEffect(() => {
    if (!clientId) {
      setVentes([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/creances/clients/${clientId}`)
      .then((r) => (r.ok ? r.json() : { ventes: [] }))
      .then((data) => {
        if (!cancelled) setVentes(data.ventes ?? []);
      })
      .catch(() => {
        if (!cancelled) setVentes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const selectedClient = clients.find((c) => c.id === clientId);

  async function handleSave() {
    const montantNum = Number(montant);
    if (!clientId || !Number.isFinite(montantNum) || montantNum <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/creances/remboursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          montant: montantNum,
          mode,
          saleId: saleId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Échec de l'enregistrement");
      }
      toast.success("Remboursement enregistré");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Enregistrer un remboursement">
      <div className="space-y-3">
        <div>
          <Label htmlFor="rb-client">Client</Label>
          <Select id="rb-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.length === 0 ? <option value="">Aucun client</option> : null}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} — solde {formatFcfa(c.solde)}
              </option>
            ))}
          </Select>
        </div>
        {selectedClient ? (
          <p className="text-xs text-muted-foreground">
            Solde actuel : <span className="font-medium text-foreground">{formatFcfa(selectedClient.solde)}</span>
          </p>
        ) : null}
        <div>
          <Label htmlFor="rb-montant">Montant reçu (FCFA)</Label>
          <Input
            id="rb-montant"
            type="number"
            min={1}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="rb-mode">Mode de règlement</Label>
          <Select id="rb-mode" value={mode} onChange={(e) => setMode(e.target.value as "ESPECES" | "MOBILE_MONEY")}>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
          </Select>
        </div>
        {ventes.length > 0 ? (
          <div>
            <Label htmlFor="rb-sale">Vente liée (optionnel)</Label>
            <Select id="rb-sale" value={saleId} onChange={(e) => setSaleId(e.target.value)}>
              <option value="">— Aucune vente précise —</option>
              {ventes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.numero} — {formatFcfa(v.total)} ({new Date(v.dateHeure).toLocaleDateString("fr-FR")})
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || !clientId || !montant}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
