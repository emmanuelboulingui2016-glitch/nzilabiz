"use client";

// Formulaire de connexion. Le bouton Google n'apparaît que si la connexion Google est réellement
// configurée : le serveur en décide et le passe en propriété, pour qu'aucun identifiant OAuth
// n'atteigne le navigateur.

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/provider";

export function LoginForm({ googleActif = false }: { googleActif?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Formulaire googleActif={googleActif} />
    </Suspense>
  );
}

function Formulaire({ googleActif }: { googleActif: boolean }) {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const erreurExterne = searchParams.get("error");

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

      {/* Ne subsiste que pour les retours d'un aller-retour OAuth qui a échoué en cours de route :
          le cas « non configuré » ne peut plus se produire, le bouton n'étant plus affiché. */}
      {erreurExterne && (
        <p className="mb-3 rounded-lg bg-warning/10 p-2 text-xs text-warning">
          La connexion Google n&apos;a pas abouti. Utilisez votre e-mail et votre mot de passe.
        </p>
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
