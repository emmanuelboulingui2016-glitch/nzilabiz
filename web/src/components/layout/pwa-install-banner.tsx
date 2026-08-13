"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { useTranslations } from "@/lib/i18n/provider";

const DISMISS_KEY = "nzilabiz.pwa-install-dismissed";

export function PwaInstallBanner() {
  const { t } = useTranslations();
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || !promptEvent) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const install = async () => {
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-primary/10 px-4 py-2 text-sm">
      <Download size={16} className="text-primary" />
      <span className="flex-1">{t("common.appName")} — Installer l&apos;application sur cet appareil</span>
      <button onClick={dismiss} className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted">
        Plus tard
      </button>
      <button onClick={install} className="rounded-lg bg-primary px-3 py-1 font-medium text-primary-foreground">
        Installer
      </button>
      <button onClick={dismiss} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
    </div>
  );
}
