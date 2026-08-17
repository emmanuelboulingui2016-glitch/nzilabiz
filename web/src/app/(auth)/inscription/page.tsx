"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n/provider";

export default function InscriptionPage() {
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
        body: JSON.stringify({ nom, storeName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'inscription");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">{t("auth.signupTitle")}</h2>
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
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
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

      <a href="/api/auth/google" className="mt-3 block">
        <Button type="button" variant="outline" className="w-full">
          {t("auth.continueWithGoogle")}
        </Button>
      </a>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/connexion" className="font-medium text-primary hover:underline">
          {t("auth.loginButton")}
        </Link>
      </p>
    </div>
  );
}
