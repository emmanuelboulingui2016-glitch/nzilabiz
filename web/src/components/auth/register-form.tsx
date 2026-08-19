"use client";

// Formulaire de création de boutique. Partagé par l'inscription publique et par le lien testeur :
// une seule implémentation, donc une seule endroit où corriger un bug de saisie ou de message.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/provider";

export function RegisterForm({
  codeTest = null,
  googleActif = false,
}: {
  codeTest?: string | null;
  /** La connexion Google n'est proposée que si elle est réellement configurée côté serveur. */
  googleActif?: boolean;
}) {
  const { t } = useTranslations();
  const router = useRouter();

  const [nom, setNom] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Le code n'est jamais saisi à la main : il vient du lien reçu. L'omettre plutôt que
        // d'envoyer une chaîne vide garde la validation côté serveur simple.
        body: JSON.stringify(codeTest ? { nom, storeName, email, password, codeTest } : { nom, storeName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'inscription");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Erreur réseau — vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && <p className="mb-3 rounded-lg bg-danger/10 p-2 text-xs text-danger">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="nom">{t("auth.yourName")}</Label>
          <Input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="storeName">{t("auth.storeName")}</Label>
          <Input id="storeName" required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </div>
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("common.loading") : t("auth.signup")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          En créant votre boutique, vous acceptez les{" "}
          <Link href="/conditions" className="font-semibold text-primary hover:underline">
            conditions d&apos;utilisation
          </Link>{" "}
          et la{" "}
          <Link href="/confidentialite" className="font-semibold text-primary hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </form>

      {/* La connexion Google ne transporte pas le code testeur : proposer ce raccourci sur le lien
          testeur ferait sortir du programme sans prévenir. Elle n'apparaît par ailleurs que si elle
          est configurée — un bouton qui renvoie une erreur vaut moins que pas de bouton. */}
      {codeTest || !googleActif ? null : (
        <a href="/api/auth/google" className="mt-3 block">
          <Button type="button" variant="outline" className="w-full">
            {t("auth.continueWithGoogle")}
          </Button>
        </a>
      )}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/connexion" className="font-medium text-primary hover:underline">
          {t("auth.loginButton")}
        </Link>
      </p>
    </>
  );
}
