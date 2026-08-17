"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, GripVertical, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

// Onglet Mobile Money — §14 + §16.
//
// La configuration est enregistrée côté serveur (table `mobile_money_settings`), donc partagée
// par tous les appareils et tous les utilisateurs de la boutique. La clé API de l'agrégateur
// n'est jamais renvoyée en clair : le serveur n'en expose que les 4 derniers caractères, et un
// champ laissé vide conserve la clé déjà enregistrée.

type Provider = "AIRTEL_MONEY" | "MOOV_MONEY";

type Config = {
  operateurPrioritaire: Provider;
  numeroMarchandAirtel: string;
  numeroMarchandMoov: string;
  agregateurSiteId: string;
  apiKeyDefinie: boolean;
  apiKeyApercu: string;
  modeProduction: boolean;
};

const DEFAULT_CONFIG: Config = {
  operateurPrioritaire: "AIRTEL_MONEY",
  numeroMarchandAirtel: "",
  numeroMarchandMoov: "",
  agregateurSiteId: "",
  apiKeyDefinie: false,
  apiKeyApercu: "",
  modeProduction: false,
};

const PROVIDER_LABEL: Record<Provider, string> = {
  AIRTEL_MONEY: "Airtel Money",
  MOOV_MONEY: "Moov Money",
};

function ordreOperateurs(prioritaire: Provider): Provider[] {
  return prioritaire === "AIRTEL_MONEY" ? ["AIRTEL_MONEY", "MOOV_MONEY"] : ["MOOV_MONEY", "AIRTEL_MONEY"];
}

export function MobileMoneyForm() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [nouvelleApiKey, setNouvelleApiKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/parametres/mobile-money")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then((data) => setConfig({ ...DEFAULT_CONFIG, ...data.config }))
      .catch(() => toast.error("Impossible de charger la configuration Mobile Money."))
      .finally(() => setLoaded(true));
  }, []);

  const swapPriority = () => {
    setConfig((prev) => ({
      ...prev,
      operateurPrioritaire: prev.operateurPrioritaire === "AIRTEL_MONEY" ? "MOOV_MONEY" : "AIRTEL_MONEY",
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/mobile-money", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operateurPrioritaire: config.operateurPrioritaire,
          numeroMarchandAirtel: config.numeroMarchandAirtel,
          numeroMarchandMoov: config.numeroMarchandMoov,
          agregateurSiteId: config.agregateurSiteId,
          agregateurApiKey: nouvelleApiKey,
          modeProduction: config.modeProduction,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      setConfig({ ...DEFAULT_CONFIG, ...data.config });
      setNouvelleApiKey("");
      toast.success("Configuration Mobile Money enregistrée pour toute la boutique.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const effacerApiKey = async () => {
    if (!window.confirm("Effacer la clé API enregistrée ?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/mobile-money", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operateurPrioritaire: config.operateurPrioritaire,
          numeroMarchandAirtel: config.numeroMarchandAirtel,
          numeroMarchandMoov: config.numeroMarchandMoov,
          agregateurSiteId: config.agregateurSiteId,
          agregateurApiKey: null,
          modeProduction: config.modeProduction,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Suppression impossible.");
        return;
      }
      setConfig({ ...DEFAULT_CONFIG, ...data.config });
      toast.success("Clé API effacée.");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>
          Ces réglages sont enregistrés pour toute la boutique, mais{" "}
          <strong>aucun paiement Mobile Money réel n&apos;est encore traité</strong> : la connexion à
          l&apos;agrégateur reste à brancher. Renseignez-les dès maintenant, ils seront utilisés tels quels.
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
          {ordreOperateurs(config.operateurPrioritaire).map((provider, index) => (
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
            directement depuis l&apos;app, sans saisie manuelle du montant. La clé API est stockée sur le
            serveur et n&apos;est jamais réaffichée en clair.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mm-apikey">
              Clé API {config.apiKeyDefinie ? <span className="font-normal">(enregistrée : {config.apiKeyApercu})</span> : null}
            </Label>
            <Input
              id="mm-apikey"
              type="password"
              autoComplete="off"
              placeholder={config.apiKeyDefinie ? "Laisser vide pour conserver la clé actuelle" : "Clé API de l'agrégateur"}
              value={nouvelleApiKey}
              onChange={(e) => setNouvelleApiKey(e.target.value)}
            />
            {config.apiKeyDefinie ? (
              <button
                type="button"
                onClick={effacerApiKey}
                className="mt-1 text-xs font-semibold text-danger hover:underline"
              >
                Effacer la clé enregistrée
              </button>
            ) : null}
          </div>
          <div>
            <Label htmlFor="mm-siteid">ID du site</Label>
            <Input
              id="mm-siteid"
              placeholder="Identifiant du site marchand"
              value={config.agregateurSiteId}
              onChange={(e) => setConfig((c) => ({ ...c, agregateurSiteId: e.target.value }))}
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
        <Button type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
