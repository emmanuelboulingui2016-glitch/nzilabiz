export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const RTL_LOCALES: Locale[] = ["ar"];

export function isRtl(locale: Locale) {
  return RTL_LOCALES.includes(locale);
}

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
};
