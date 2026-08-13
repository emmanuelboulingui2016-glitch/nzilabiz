"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const CURRENCIES = [
  { code: "XAF", label: "Franc CFA (XAF) — CEMAC" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "Dollar américain (USD)" },
] as const;

// Clé de stockage local pour le taux de change manuel — voir note ⚠️ ci-dessous.
const FX_RATE_STORAGE_KEY = "nzilabiz_fx_rate_manual";

export function DeviseForm({ initialDevise }: { initialDevise: string }) {
  const [devise, setDevise] = useState(initialDevise);
  const [fxRate, setFxRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(FX_RATE_STORAGE_KEY);
    if (stored) setFxRate(stored);
  }, []);

  const handleFxRateChange = (value: string) => {
    setFxRate(value);
    window.localStorage.setItem(FX_RATE_STORAGE_KEY, value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/devise", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devise }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible d'enregistrer la devise.");
        return;
      }
      toast.success("Devise mise à jour.");
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
          <CardTitle>Devise de la boutique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le FCFA (XAF) reste la devise par défaut recommandée en zone CEMAC. Les autres devises sont
            proposées pour une expansion future hors zone.
          </p>

          <div className="max-w-xs">
            <Label htmlFor="devise">Devise</Label>
            <Select id="devise" value={devise} onChange={(e) => setDevise(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          {devise !== "XAF" && (
            <div className="max-w-xs">
              <Label htmlFor="fxRate">Taux de change manuel (1 {devise} = ? XAF)</Label>
              <Input
                id="fxRate"
                type="number"
                min="0"
                step="0.01"
                value={fxRate}
                onChange={(e) => handleFxRateChange(e.target.value)}
                placeholder="Ex. 655.96"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                ⚠️ Ce taux est enregistré uniquement sur cet appareil (pas encore synchronisé côté
                serveur) — voir le résumé de la tâche pour le détail.
              </p>
            </div>
          )}
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
