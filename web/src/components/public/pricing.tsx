"use client";

// Bloc tarifs interactif : la période choisie met à jour le prix affiché, l'économie réalisée et
// le coût ramené au mois — c'est la question que se pose un commerçant devant trois formules.
// Les montants sont ceux de l'écran Paramètres > Abonnement.

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ContactSupport } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { cn } from "@/lib/utils";

type Periode = "mensuel" | "trimestriel" | "annuel";

const OFFRES: Record<
  Periode,
  { label: string; montant: number; mois: number; parMois: number; economie: number }
> = {
  mensuel: { label: "Mensuel", montant: 35000, mois: 1, parMois: 35000, economie: 0 },
  trimestriel: { label: "Trimestriel", montant: 95000, mois: 3, parMois: 31667, economie: 10000 },
  annuel: { label: "Annuel", montant: 350000, mois: 12, parMois: 29167, economie: 70000 },
};

const AVANTAGES_PREMIUM = [
  "Produits et ventes illimités",
  "Utilisateurs illimités (patron, gérants, vendeurs)",
  "Mode hors connexion complet",
  "Rapports avancés et exports PDF/CSV",
  "Support prioritaire WhatsApp",
];

function fcfa(montant: number) {
  return `${Math.round(montant).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;
}

export function Pricing({ contact }: { contact: ContactCommercial }) {
  const [periode, setPeriode] = useState<Periode>("annuel");
  const offre = OFFRES[periode];

  return (
    <>
      <div className="mt-8 inline-flex rounded-full bg-muted p-1">
        {(Object.keys(OFFRES) as Periode[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriode(p)}
            aria-pressed={periode === p}
            className={cn(
              "relative rounded-full px-4 py-2 text-sm font-bold transition-colors sm:px-5",
              periode === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {OFFRES[p].label}
            {OFFRES[p].economie > 0 ? (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                  periode === p ? "bg-white/20" : "bg-success/15 text-success"
                )}
              >
                −{Math.round((OFFRES[p].economie / (35000 * OFFRES[p].mois)) * 100)} %
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
          <h3 className="text-lg font-bold">Essai</h3>
          <p className="mt-1 text-3xl font-extrabold">Gratuit</p>
          <p className="text-sm text-muted-foreground">15 jours, toutes les fonctionnalités</p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "Aucune carte bancaire",
              "Catalogue de démarrage prêt à l'emploi",
              "Vos données conservées si vous continuez",
            ].map((l) => (
              <li key={l} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" /> {l}
              </li>
            ))}
          </ul>
          <Link
            href="/inscription"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border text-sm font-bold transition-colors hover:bg-muted"
          >
            Commencer
          </Link>
        </div>

        <div className="relative rounded-xl border-2 border-primary bg-card p-6 shadow-sm transition-transform duration-300 lg:-translate-y-2 lg:hover:-translate-y-3">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            Le plus choisi
          </span>
          <h3 className="mt-3 text-lg font-bold">Premium</h3>

          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {fcfa(offre.montant)}
            <span className="text-base font-bold text-muted-foreground">
              {periode === "mensuel" ? " / mois" : periode === "trimestriel" ? " / trimestre" : " / an"}
            </span>
          </p>
          <p className="min-h-10 text-sm text-muted-foreground">
            {periode === "mensuel" ? (
              "Sans engagement, résiliable à tout moment."
            ) : (
              <>
                Soit <strong className="text-foreground">{fcfa(offre.parMois)}</strong> par mois —{" "}
                <span className="font-semibold text-success">{fcfa(offre.economie)} économisés</span> par
                rapport au mensuel.
              </>
            )}
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            {AVANTAGES_PREMIUM.map((l) => (
              <li key={l} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" /> {l}
              </li>
            ))}
          </ul>
          <Link
            href="/inscription"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Démarrer l&apos;essai
          </Link>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Facturé après vos 15 jours d&apos;essai.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
          <h3 className="text-lg font-bold">Entreprise</h3>
          <p className="mt-1 text-3xl font-extrabold">
            700 000 <span className="text-base font-bold text-muted-foreground">FCFA / an</span>
          </p>
          <p className="text-sm text-muted-foreground">À partir de — tarif sur devis</p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "Plusieurs boutiques sous un seul compte",
              "Chiffres consolidés sur tout le réseau",
              "Utilisateurs illimités",
              "Support dédié",
              "Formation des équipes incluse",
            ].map((l) => (
              <li key={l} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" /> {l}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <ContactSupport contact={contact} sujet="Demande de formule Entreprise" />
          </div>
        </div>
      </div>
    </>
  );
}
