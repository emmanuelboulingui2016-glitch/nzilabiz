"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SecurityInitial = {
  nom: string;
  email: string;
  aMotDePasse: boolean;
  googleLie: boolean;
  twoFactorActive: boolean;
};

async function callSecurite(body: Record<string, unknown>) {
  const res = await fetch("/api/parametres/securite", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function SecurityForm({ initial }: { initial: SecurityInitial }) {
  const [nom, setNom] = useState(initial.nom);
  const [savingProfile, setSavingProfile] = useState(false);

  const [aMotDePasse, setAMotDePasse] = useState(initial.aMotDePasse);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [twoFactorActive, setTwoFactorActive] = useState(initial.twoFactorActive);
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  const handleProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { ok, data } = await callSecurite({ action: "profile", nom });
      if (!ok) {
        toast.error(data.error ?? "Impossible d'enregistrer.");
        return;
      }
      toast.success("Nom affiché mis à jour.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setSavingPassword(true);
    try {
      const { ok, data } = await callSecurite({
        action: "password",
        currentPassword: aMotDePasse ? currentPassword : undefined,
        newPassword,
      });
      if (!ok) {
        toast.error(data.error ?? "Impossible de définir le mot de passe.");
        return;
      }
      toast.success("Mot de passe défini avec succès.");
      setAMotDePasse(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSavingPassword(false);
    }
  };

  const startTwoFa = async () => {
    setTwoFaBusy(true);
    try {
      const { ok, data } = await callSecurite({ action: "2fa-init" });
      if (!ok) {
        toast.error(data.error ?? "Impossible de démarrer la configuration 2FA.");
        return;
      }
      setTwoFaSecret(data.secret);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setTwoFaBusy(false);
    }
  };

  const verifyTwoFa = async (e: FormEvent) => {
    e.preventDefault();
    setTwoFaBusy(true);
    try {
      const { ok, data } = await callSecurite({ action: "2fa-verify", code: twoFaCode });
      if (!ok) {
        toast.error(data.error ?? "Code invalide.");
        return;
      }
      setTwoFactorActive(true);
      setTwoFaSecret(null);
      setTwoFaCode("");
      toast.success("Authentification à deux facteurs activée.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setTwoFaBusy(false);
    }
  };

  const disableTwoFa = async () => {
    if (!window.confirm("Désactiver l'authentification à deux facteurs ?")) return;
    setTwoFaBusy(true);
    try {
      const { ok, data } = await callSecurite({ action: "2fa-disable" });
      if (!ok) {
        toast.error(data.error ?? "Impossible de désactiver le 2FA.");
        return;
      }
      setTwoFactorActive(false);
      setTwoFaSecret(null);
      toast.success("Authentification à deux facteurs désactivée.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setTwoFaBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfile} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sec-nom">Nom affiché</Label>
              <Input id="sec-nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="sec-email">E-mail du compte</Label>
              <Input id="sec-email" value={initial.email} disabled />
              <p className="mt-1 text-xs text-muted-foreground">
                L&apos;e-mail sert d&apos;identifiant de connexion et n&apos;est pas modifiable ici.
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comptes liés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm font-medium">Google</span>
            {initial.googleLie ? (
              <Badge tone="success">
                <CheckCircle2 size={12} /> Connecté
              </Badge>
            ) : (
              <Badge tone="neutral">Non connecté</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{aMotDePasse ? "Changer le mot de passe" : "Définir un mot de passe"}</CardTitle>
          {!aMotDePasse && (
            <p className="text-xs text-muted-foreground">
              Votre compte a été créé via Google et n&apos;a pas encore de mot de passe. Vous pouvez en définir
              un ici pour pouvoir aussi vous connecter par e-mail/mot de passe.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePassword} className="grid gap-4 sm:grid-cols-2">
            {aMotDePasse && (
              <div className="sm:col-span-2">
                <Label htmlFor="sec-current">Mot de passe actuel</Label>
                <Input
                  id="sec-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="sec-new">Nouveau mot de passe</Label>
              <Input
                id="sec-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div>
              <Label htmlFor="sec-confirm">Confirmer le mot de passe</Label>
              <Input
                id="sec-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                <KeyRound size={14} />
                {savingPassword ? "Enregistrement..." : "Enregistrer le mot de passe"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Authentification à deux facteurs (2FA)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Code à usage unique généré par une appli comme Google Authenticator ou Authy.
            </p>
          </div>
          <Badge tone={twoFactorActive ? "success" : "neutral"}>
            <ShieldCheck size={12} /> {twoFactorActive ? "Activé" : "Désactivé"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning">
            Important : dans ce build, l&apos;écran de connexion ne demande pas encore ce second facteur — seule
            l&apos;activation/désactivation du réglage est fonctionnelle. L&apos;application complète au login sera
            une prochaine itération.
          </p>

          {!twoFactorActive && !twoFaSecret && (
            <Button variant="outline" onClick={startTwoFa} disabled={twoFaBusy}>
              Activer le 2FA
            </Button>
          )}

          {!twoFactorActive && twoFaSecret && (
            <form onSubmit={verifyTwoFa} className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm">
                Ajoutez ce compte dans votre appli d&apos;authentification en saisissant la clé secrète
                manuellement (pas de QR code dans ce build) :
              </p>
              <code className={cn("block break-all rounded bg-muted px-2 py-1.5 font-mono text-sm")}>
                {twoFaSecret}
              </code>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-40">
                  <Label htmlFor="sec-2fa-code">Code à 6 chiffres</Label>
                  <Input
                    id="sec-2fa-code"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    required
                  />
                </div>
                <Button type="submit" disabled={twoFaBusy}>
                  Confirmer et activer
                </Button>
              </div>
            </form>
          )}

          {twoFactorActive && (
            <Button variant="danger" onClick={disableTwoFa} disabled={twoFaBusy}>
              Désactiver le 2FA
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
