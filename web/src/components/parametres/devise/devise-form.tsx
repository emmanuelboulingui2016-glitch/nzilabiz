"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const CURRENCIES = [
  { code: "XAF", label: "Franc CFA (XAF) — CEMAC" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "Dollar américain (USD)" },
] as const;

export function DeviseForm({
  initialDevise,
  initialTauxChange,
}: {
  initialDevise: string;
  initialTauxChange: number | null;
}) {
  const [devise, setDevise] = useState(initialDevise);
  const [fxRate, setFxRate] = useState(initialTauxChange !== null ? String(initialTauxChange) : "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/devise", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          devise,
          tauxChangeManuel: devise === "XAF" || fxRate.trim() === "" ? null : Number(fxRate),
        }),
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
                onChange={(e) => setFxRate(e.target.value)}
                placeholder="Ex. 655.96"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enregistré avec la devise, pour toute la boutique et tous ses appareils.
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
