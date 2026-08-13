"use client";

import { useState } from "react";
import { Bell, Moon, Sun, Search, Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "@/lib/i18n/provider";
import { useTheme } from "@/lib/theme-provider";
import { useOnlineStatus } from "@/lib/use-online-status";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function Topbar({ notificationCount = 0 }: { notificationCount?: number }) {
  const { t, locale, setLocale } = useTranslations();
  const { theme, toggle } = useTheme();
  const online = useOnlineStatus();
  const [query, setQuery] = useState("");

  return (
    <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-4">
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
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

        <button aria-label="Notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
