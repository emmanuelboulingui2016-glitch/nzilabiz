"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Moon, Sun, Search, Wifi, WifiOff, Package, User, Receipt, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme-provider";
import { useOnlineStatus } from "@/lib/use-online-status";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { SelecteurBoutique, type BoutiqueOption } from "./selecteur-boutique";

type Resultat = {
  type: "produit" | "client" | "vente";
  id: string;
  titre: string;
  sousTitre: string;
  href: string;
};

type Alerte = {
  id: string;
  niveau: "danger" | "warning" | "info";
  titre: string;
  detail: string;
  href: string;
};

const ICONE_TYPE = { produit: Package, client: User, vente: Receipt } as const;

const TON_ALERTE = {
  danger: "border-danger/40 bg-danger/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-primary/40 bg-primary/5",
} as const;

export function Topbar({
  boutiques = [],
  boutiqueActiveId,
}: {
  boutiques?: BoutiqueOption[];
  boutiqueActiveId?: string;
}) {
  const { t, locale, setLocale } = useTranslations();
  const { theme, toggle } = useTheme();
  const online = useOnlineStatus();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [alertesOuvertes, setAlertesOuvertes] = useState(false);
  const rechercheRef = useRef<HTMLDivElement>(null);
  const clocheRef = useRef<HTMLDivElement>(null);

  // Recherche différée : on attend une pause de frappe pour ne pas lancer une requête par lettre.
  useEffect(() => {
    const terme = query.trim();
    if (terme.length < 2) {
      setResultats([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/recherche?q=${encodeURIComponent(terme)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("recherche"))))
        .then((data) => setResultats(data.resultats ?? []))
        .catch(() => setResultats([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const chargerAlertes = useCallback(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("alertes"))))
      .then((data) => setAlertes(data.alertes ?? []))
      .catch(() => setAlertes([]));
  }, []);

  useEffect(() => {
    chargerAlertes();
    // Les alertes sont des états (stock bas, retards de paiement) : un rafraîchissement toutes
    // les 5 minutes suffit largement et n'alourdit pas le serveur.
    const timer = setInterval(chargerAlertes, 5 * 60_000);
    return () => clearInterval(timer);
  }, [chargerAlertes]);

  // Fermeture des panneaux au clic extérieur et à la touche Échap.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const cible = e.target as Node;
      if (rechercheRef.current && !rechercheRef.current.contains(cible)) setRechercheOuverte(false);
      if (clocheRef.current && !clocheRef.current.contains(cible)) setAlertesOuvertes(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRechercheOuverte(false);
        setAlertesOuvertes(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const ouvrirResultat = (href: string) => {
    setRechercheOuverte(false);
    setQuery("");
    router.push(href);
  };

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4">
      {/* La barre latérale est masquée sous 768 px. Sans ce rappel, un commerçant en réseau ne
          pourrait pas changer de boutique depuis son téléphone — c'est-à-dire presque jamais. */}
      {boutiques.length > 1 && boutiqueActiveId ? (
        <div className="md:hidden">
          <SelecteurBoutique boutiques={boutiques} activeId={boutiqueActiveId} variante="compact" />
        </div>
      ) : null}

      <div ref={rechercheRef} className="relative flex-1 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setRechercheOuverte(true);
          }}
          onFocus={() => setRechercheOuverte(true)}
          placeholder={t("common.search")}
          aria-label={t("common.search")}
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              setResultats([]);
            }}
            aria-label={t("common.close")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={14} />
          </button>
        ) : null}

        {rechercheOuverte && query.trim().length >= 2 ? (
          <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            {resultats.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                Aucun résultat pour « {query.trim()} ».
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {resultats.map((r) => {
                  const Icone = ICONE_TYPE[r.type];
                  return (
                    <li key={`${r.type}-${r.id}`}>
                      <button
                        onClick={() => ouvrirResultat(r.href)}
                        className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 hover:bg-muted"
                      >
                        <Icone size={16} className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{r.titre}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.sousTitre}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            online ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
          )}
        >
          {online ? <Wifi size={13} /> : <WifiOff size={13} />}
          {online ? t("common.online") : t("common.offline")}
        </span>

        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none"
          aria-label="Langue"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABELS[l]}
            </option>
          ))}
        </select>

        <button
          onClick={toggle}
          aria-label="Mode sombre"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div ref={clocheRef} className="relative">
          <button
            onClick={() => {
              setAlertesOuvertes((v) => !v);
              if (!alertesOuvertes) chargerAlertes();
            }}
            aria-label="Notifications"
            aria-expanded={alertesOuvertes}
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <Bell size={18} />
            {alertes.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {alertes.length}
              </span>
            )}
          </button>

          {alertesOuvertes ? (
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
              <p className="border-b border-border px-4 py-2.5 text-sm font-bold">Alertes</p>
              {alertes.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Rien à signaler — stock, créances et approbations sont à jour.
                </p>
              ) : (
                <ul className="max-h-96 space-y-2 overflow-y-auto p-2">
                  {alertes.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={a.href}
                        onClick={() => setAlertesOuvertes(false)}
                        className={cn("block rounded-lg border p-3 hover:brightness-95", TON_ALERTE[a.niveau])}
                      >
                        <p className="text-sm font-bold">{a.titre}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
