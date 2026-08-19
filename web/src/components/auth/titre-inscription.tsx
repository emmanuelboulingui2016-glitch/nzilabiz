"use client";

// Titre de la page d'inscription. Isolé dans son propre composant client parce qu'il dépend des
// traductions, ce qui permet à la page elle-même de rester un composant serveur.

import { useTranslations } from "@/lib/i18n/provider";

export function TitreInscription() {
  const { t } = useTranslations();
  return <h2 className="mb-4 text-lg font-semibold">{t("auth.signupTitle")}</h2>;
}
