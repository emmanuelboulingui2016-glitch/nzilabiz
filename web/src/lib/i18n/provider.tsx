"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, isRtl, type Locale } from "./config";
import fr from "./dictionaries/fr.json";
import en from "./dictionaries/en.json";
import ar from "./dictionaries/ar.json";

const DICTIONARIES: Record<Locale, any> = { fr, en, ar };
const STORAGE_KEY = "nzilabiz.locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolve(dict: any, key: string): string | undefined {
  return key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (window.localStorage.getItem(STORAGE_KEY) as Locale | null) : null;
    if (stored && DICTIONARIES[stored]) setLocaleState(stored);
  }, []);

  useEffect(() => {
    const dir = isRtl(locale) ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
      let value = resolve(dict, key) ?? resolve(DICTIONARIES[DEFAULT_LOCALE], key) ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replaceAll(`{${k}}`, String(v));
        }
      }
      return value;
    };
  }, [locale]);

  const dir = isRtl(locale) ? "rtl" : "ltr";

  return <I18nContext.Provider value={{ locale, setLocale, t, dir }}>{children}</I18nContext.Provider>;
}

export function useTranslations() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslations must be used within I18nProvider");
  return ctx;
}
