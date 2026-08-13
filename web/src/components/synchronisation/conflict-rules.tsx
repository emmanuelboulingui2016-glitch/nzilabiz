"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";

const STORAGE_KEY = "nzilabiz.sync_conflict_rule";

const RULES = [
  { value: "dernier_ecrit_gagne", label: "Dernier écrit gagne" },
  { value: "priorite_patron", label: "Priorité au Patron" },
  { value: "validation_manuelle", label: "Validation manuelle" },
] as const;

type Rule = (typeof RULES)[number]["value"];

export function ConflictRules() {
  const [rule, setRule] = useState<Rule>("dernier_ecrit_gagne");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Rule | null;
    if (stored && RULES.some((r) => r.value === stored)) setRule(stored);
    setLoaded(true);
  }, []);

  const onChange = (value: Rule) => {
    setRule(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    toast.success("Préférence enregistrée sur cet appareil.");
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Règle de résolution de conflits</CardTitle>
        <p className="text-xs text-muted-foreground">
          Quand deux appareils modifient la même donnée hors-ligne avant de se synchroniser, quelle règle
          doit s&apos;appliquer ?
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="conflict-rule">Règle préférée</Label>
          <Select
            id="conflict-rule"
            value={rule}
            onChange={(e) => onChange(e.target.value as Rule)}
            className="max-w-sm"
          >
            {RULES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Aujourd&apos;hui, le moteur de synchronisation applique toujours la règle « dernier écrit gagne »
          côté serveur, quelle que soit la préférence choisie ici. Cette préférence est enregistrée
          localement sur cet appareil ; son application automatique par le serveur (priorité au Patron,
          file de validation manuelle des conflits) est une amélioration future.
        </p>
      </CardContent>
    </Card>
  );
}
