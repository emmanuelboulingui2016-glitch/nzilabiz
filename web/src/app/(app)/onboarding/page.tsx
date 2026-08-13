"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATALOG_TEMPLATES } from "@/lib/onboarding/templates";
import { useTranslations } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function OnboardingPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  const applyTemplate = async () => {
    if (!selected) {
      setStep(3);
      return;
    }
    setApplying(true);
    try {
      const res = await fetch("/api/onboarding/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected }),
      });
      const data = await res.json();
      if (res.ok) setApplied(data.count);
      setStep(3);
    } finally {
      setApplying(false);
    }
  };

  const steps = [t("auth.onboardingStep1"), t("auth.onboardingStep2"), t("auth.onboardingStep3")];

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {step > i + 1 ? <Check size={16} /> : i + 1}
            </div>
            <span className="hidden text-sm font-medium sm:inline">{label}</span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Votre boutique est créée 🎉</h2>
            <p className="text-sm text-muted-foreground">
              Ajoutons maintenant quelques produits pour démarrer plus vite. Vous pourrez tout modifier ensuite dans Stock.
            </p>
            <Button onClick={() => setStep(2)}>{t("common.next")}</Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Choisissez un modèle de catalogue</h2>
            <p className="text-sm text-muted-foreground">
              Quelques produits types seront ajoutés automatiquement — modifiables ensuite dans Stock.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CATALOG_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelected(tpl.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    selected === tpl.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  )}
                >
                  <p className="text-sm font-medium">{tpl.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                Passer cette étape
              </Button>
              <Button onClick={applyTemplate} disabled={applying}>
                {applying ? t("common.loading") : t("common.next")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Prêt à vendre !</h2>
            {applied !== null && (
              <p className="text-sm text-success">{applied} produits ajoutés à votre catalogue.</p>
            )}
            <p className="text-sm text-muted-foreground">
              Ouvrez l&apos;écran Vendre pour encaisser votre première vente, ou allez sur Stock pour ajuster votre catalogue.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push("/stock")}>
                Aller au Stock
              </Button>
              <Button onClick={() => router.push("/vendre")}>{t("nav.vendre")}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
