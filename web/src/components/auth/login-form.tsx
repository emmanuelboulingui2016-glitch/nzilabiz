"use client";

// Formulaire de connexion. Le bouton Google n'apparaît que si la connexion Google est réellement
// configurée : le serveur en décide et le passe en propriété, pour qu'aucun identifiant OAuth
// n'atteigne le navigateur.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/provider";

/** Traduit le motif renvoyé par /api/auth/google/callback en une phrase utile au visiteur. */
function messageGoogle(raison: string): string {
  switch (raison) {
    case "google_email_non_verifie":
      return "Google n'a pas confirmé cette adresse e-mail. Vérifiez-la dans votre compte Google, ou connectez-vous avec votre mot de passe.";
    case "google_compte_ferme":
      return "Ce compte a été supprimé et ne permet plus de se connecter.";
    case "google_adresse_reservee":
      return "Cette adresse ne peut pas servir à créer une boutique.";
    case "google_trop_de_tentatives":
      return "Trop de tentatives de connexion Google. Réessayez dans quelques minutes.";
    default:
      return "La connexion Google n'a pas abouti. Utilisez votre e-mail et votre mot de passe.";
  }
}

export function LoginForm({
  googleActif = false,
  erreur = null,
}: {
  googleActif?: boolean;
  /** Motif d'un retour Google qui n'a pas abouti, lu dans l'adresse par la page serveur. */
  erreur?: string | null;
}) {
  const { t } = useTranslations();
  const router = useRouter();
  const erreurExterne = erreur;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur de connexion");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erreur réseau — vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("auth.loginTitle")}</h2>

      {/* Retour d'un aller-retour OAuth qui n'a pas abouti. Le message dit ce qui s'est passé quand
          la personne peut y faire quelque chose ; sinon il reste général plutôt que d'afficher un
          code technique que personne ne peut interpréter. */}
      {erreurExterne && (
        <p className="mb-3 rounded-lg bg-warning/10 p-2 text-xs text-warning">{messageGoogle(erreurExterne)}</p>
      )}
      {error && <p className="mb-3 rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t("auth.rememberMe")}
          </label>
          <Link href="/mot-de-passe-oublie" className="text-primary hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("common.loading") : t("auth.loginButton")}
        </Button>
      </form>

      {googleActif ? (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <div className="h-px flex-1 bg-border" />
          </div>
          <a href="/api/auth/google">
            <Button type="button" variant="outline" className="w-full">
              {t("auth.continueWithGoogle")}
            </Button>
          </a>
        </>
      ) : null}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/inscription" className="font-medium text-primary hover:underline">
          {t("auth.signup")}
        </Link>
      </p>
    </div>
  );
}
