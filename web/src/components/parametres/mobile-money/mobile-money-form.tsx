"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, GripVertical, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Onglet Mobile Money — §14 + §16 🔧. Écran de configuration réel (Airtel Money en priorité par
// défaut, cf. §20, puis Moov Money) + champs d'identifiants pour un futur agrégateur type
// CinetPay. AUCUNE intégration de paiement réelle ici : ce sont des champs de configuration
// destinés à préparer le branchement d'un agrégateur, pas un flux de paiement fonctionnel.
//
// 🔧 Simplification assumée (voir résumé de tâche / README) : persisté en `localStorage`
// uniquement (clé par boutique), PAS sur le serveur — `schema.ts` est partagé et hors périmètre de
// cet agent, il n'y a pas de table dédiée. Une prochaine itération doit ajouter une table
// `mobile_money_settings` et brancher `GET/PUT /api/parametres/mobile-money` dessus (route déjà
// posée en stub).

type Provider = "AIRTEL_MONEY" | "MOOV_MONEY";

type Config = {
  providerOrder: Provider[];
  numeroMarchandAirtel: string;
  numeroMarchandMoov: string;
  cinetpayApiKey: string;
  cinetpaySiteId: string;
  modeProduction: boolean;
};

const DEFAULT_CONFIG: Config = {
  providerOrder: ["AIRTEL_MONEY", "MOOV_MONEY"],
  numeroMarchandAirtel: "",
  numeroMarchandMoov: "",
  cinetpayApiKey: "",
  cinetpaySiteId: "",
  modeProduction: false,
};

const PROVIDER_LABEL: Record<Provider, string> = {
  AIRTEL_MONEY: "Airtel Money",
  MOOV_MONEY: "Moov Money",
};

function storageKey(storeId: string) {
  return `nzilabiz:mobile-money-config:${storeId}`;
}

export function MobileMoneyForm({ storeId }: { storeId: string }) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(storeId));
      if (raw) {
        const parsed = JSON.parse(raw);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      }
    } catch {
      // localStorage indisponible ou JSON corrompu — on repart des valeurs par défaut.
    } finally {
      setLoaded(true);
    }
  }, [storeId]);

  const swapPriority = () => {
    setConfig((prev) => ({ ...prev, providerOrder: [prev.providerOrder[1], prev.providerOrder[0]] }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    try {
      window.localStorage.setItem(storageKey(storeId), JSON.stringify(config));
      toast.success("Configuration Mobile Money enregistrée sur cet appareil.");
    } catch {
      toast.error("Impossible d'enregistrer localement (stockage du navigateur indisponible).");
    }
  };

  if (!loaded) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          <strong>Configuration locale</strong>, à connecter à un vrai stockage serveur. Cette configuration est
          enregistrée uniquement dans le navigateur de cet appareil (localStorage) — elle n&apos;est pas partagée
          entre appareils ni sauvegardée côté serveur tant qu&apos;une table dédiée n&apos;est pas ajoutée au
          schéma. Aucun paiement Mobile Money réel n&apos;est traité par cet écran.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Priorité des opérateurs</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ordre dans lequel l&apos;opérateur est proposé à l&apos;encaissement (Airtel Money en premier par
            défaut, cf. cahier des charges §20).
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {config.providerOrder.map((provider, index) => (
            <div key={provider} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <GripVertical size={16} className="text-muted-foreground" />
              <Badge tone="info">{index + 1}</Badge>
              <span className="text-sm font-medium">{PROVIDER_LABEL[provider]}</span>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={swapPriority}>
            Inverser la priorité
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Numéros marchands</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mm-airtel">Numéro marchand Airtel Money</Label>
            <Input
              id="mm-airtel"
              placeholder="074 XX XX XX"
              value={config.numeroMarchandAirtel}
              onChange={(e) => setConfig((c) => ({ ...c, numeroMarchandAirtel: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="mm-moov">Numéro marchand Moov Money</Label>
            <Input
              id="mm-moov"
              placeholder="062 XX XX XX"
              value={config.numeroMarchandMoov}
              onChange={(e) => setConfig((c) => ({ ...c, numeroMarchandMoov: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identifiants agrégateur (ex. CinetPay)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Un agrégateur de paiement (CinetPay ou équivalent) permet d&apos;encaisser Airtel Money / Moov Money
            directement depuis l&apos;app, sans passer par une saisie manuelle du montant. Ces champs préparent
            cette intégration ; ils ne sont pas encore utilisés pour un paiement réel.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mm-apikey">Clé API CinetPay</Label>
            <Input
              id="mm-apikey"
              type="password"
              placeholder="Clé API de l'agrégateur"
              value={config.cinetpayApiKey}
              onChange={(e) => setConfig((c) => ({ ...c, cinetpayApiKey: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="mm-siteid">ID du site</Label>
            <Input
              id="mm-siteid"
              placeholder="Identifiant du site marchand"
              value={config.cinetpaySiteId}
              onChange={(e) => setConfig((c) => ({ ...c, cinetpaySiteId: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="mm-mode">Mode</Label>
            <Select
              id="mm-mode"
              value={config.modeProduction ? "production" : "test"}
              onChange={(e) => setConfig((c) => ({ ...c, modeProduction: e.target.value === "production" }))}
            >
              <option value="test">Test</option>
              <option value="production">Production</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">
          <Save size={16} />
          Enregistrer (local)
        </Button>
      </div>
    </form>
  );
}
