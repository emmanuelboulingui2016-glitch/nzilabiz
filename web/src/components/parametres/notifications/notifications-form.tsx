"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NotificationsInitial = {
  creanceRetardJours: number;
  grosseDepenseSeuil: number;
  peremptionAlerteJours: number;
  alerteStockBas: boolean;
  alertePeremption: boolean;
  alerteCreanceRetard: boolean;
  alerteVenteRealisee: boolean;
  alerteGrosseDepense: boolean;
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}

export function NotificationsForm({ initial }: { initial: NotificationsInitial }) {
  const [creanceRetardJours, setCreanceRetardJours] = useState(String(initial.creanceRetardJours));
  const [grosseDepenseSeuil, setGrosseDepenseSeuil] = useState(String(initial.grosseDepenseSeuil));
  const [peremptionAlerteJours, setPeremptionAlerteJours] = useState(String(initial.peremptionAlerteJours));
  const [alerteStockBas, setAlerteStockBas] = useState(initial.alerteStockBas);
  const [alertePeremption, setAlertePeremption] = useState(initial.alertePeremption);
  const [alerteCreanceRetard, setAlerteCreanceRetard] = useState(initial.alerteCreanceRetard);
  const [alerteVenteRealisee, setAlerteVenteRealisee] = useState(initial.alerteVenteRealisee);
  const [alerteGrosseDepense, setAlerteGrosseDepense] = useState(initial.alerteGrosseDepense);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creanceRetardJours: Number(creanceRetardJours) || 0,
          grosseDepenseSeuil: Number(grosseDepenseSeuil) || 0,
          peremptionAlerteJours: Number(peremptionAlerteJours) || 0,
          alerteStockBas,
          alertePeremption,
          alerteCreanceRetard,
          alerteVenteRealisee,
          alerteGrosseDepense,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible d'enregistrer les notifications.");
        return;
      }
      toast.success("Préférences de notifications mises à jour.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-20 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>Seuils d&apos;alerte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="creanceRetardJours">Créance « en retard » après (jours)</Label>
            <Input
              id="creanceRetardJours"
              type="number"
              min={0}
              max={365}
              value={creanceRetardJours}
              onChange={(e) => setCreanceRetardJours(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="grosseDepenseSeuil">« Grosse » dépense à partir de (FCFA)</Label>
            <Input
              id="grosseDepenseSeuil"
              type="number"
              min={0}
              step={100}
              value={grosseDepenseSeuil}
              onChange={(e) => setGrosseDepenseSeuil(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="peremptionAlerteJours">Alerter avant péremption (jours)</Label>
            <Input
              id="peremptionAlerteJours"
              type="number"
              min={0}
              max={365}
              value={peremptionAlerteJours}
              onChange={(e) => setPeremptionAlerteJours(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Types d&apos;alertes</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <ToggleRow
            label="Stock bas"
            description="Alerte quand un produit atteint son seuil d'alerte."
            checked={alerteStockBas}
            onChange={setAlerteStockBas}
          />
          <ToggleRow
            label="Péremption proche"
            description="Alerte avant la date de péremption d'un produit."
            checked={alertePeremption}
            onChange={setAlertePeremption}
          />
          <ToggleRow
            label="Créance en retard"
            description="Alerte quand une créance dépasse le délai défini ci-dessus."
            checked={alerteCreanceRetard}
            onChange={setAlerteCreanceRetard}
          />
          <ToggleRow
            label="Vente réalisée"
            description="Notification à chaque vente enregistrée."
            checked={alerteVenteRealisee}
            onChange={setAlerteVenteRealisee}
          />
          <ToggleRow
            label="Grosse dépense"
            description="Alerte quand une dépense dépasse le seuil défini ci-dessus."
            checked={alerteGrosseDepense}
            onChange={setAlerteGrosseDepense}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
