"use client";

// Bloc tarifs interactif : la période choisie met à jour le prix affiché, l'économie réalisée et
// le coût ramené au mois — c'est la question que se pose un commerçant devant trois formules.
//
// Les montants ne sont plus écrits ici. Ils viennent de la grille tarifaire, modifiable depuis
// l'administration, et sont passés en propriété : ce composant et l'écran Abonnement affichaient
// auparavant deux copies du même prix, qui pouvaient diverger sans que rien ne le signale.
//
// L'essai n'a plus sa colonne. Il ne s'oppose pas aux formules, il les précède toutes : en faire
// une quatrième carte laissait croire qu'il fallait choisir entre « essai » et « premium », et
// réduisait la place des offres réellement payantes.

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { ContactSupport } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { ARGUMENTAIRE } from "@/lib/formules";
import { CYCLES, LIBELLE_CYCLE, MOIS_PAR_CYCLE, economiePourcent, type Cycle, type Grille } from "@/lib/tarifs";
import { cn } from "@/lib/utils";

function fcfa(montant: number) {
  return `${Math.round(montant).toLocaleString("fr-FR").replace(/ | /g, " ")} FCFA`;
}

const SUFFIXE: Record<Cycle, string> = { mensuel: "/ mois", trimestriel: "/ trimestre", annuel: "/ an" };

export function Pricing({ contact, grille }: { contact: ContactCommercial; grille: Grille }) {
  const [periode, setPeriode] = useState<Cycle>("annuel");

  const essentiel = grille.ESSENTIEL[periode];
  const premium = grille.PREMIUM[periode];
  const entreprise = grille.ENTREPRISE.annuel;

  const detail = (montant: number | undefined) => {
    if (!montant) return null;
    if (periode === "mensuel") return "Sans engagement, résiliable à tout moment.";
    const parMois = Math.round(montant / MOIS_PAR_CYCLE[periode]);
    return (
      <>
        Soit <strong className="text-foreground">{fcfa(parMois)}</strong> par mois.
      </>
    );
  };

  return (
    <>
      <p className="mt-6 text-sm text-muted-foreground">
        Toutes les formules commencent par <strong className="text-foreground">15 jours d&apos;essai gratuit</strong>,
        sans carte bancaire, avec l&apos;ensemble des fonctionnalités.
      </p>

      <div className="mt-6 inline-flex rounded-full bg-muted p-1">
        {CYCLES.map((c) => {
          const remise = economiePourcent(grille, "PREMIUM", c);
          return (
            <button
              key={c}
              onClick={() => setPeriode(c)}
              aria-pressed={periode === c}
              className={cn(
                "relative rounded-full px-4 py-2 text-sm font-bold transition-colors sm:px-5",
                periode === c
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {LIBELLE_CYCLE[c]}
              {remise > 0 ? (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold",
                    periode === c ? "bg-white/20" : "bg-success/15 text-success"
                  )}
                >
                  −{remise} %
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {/* Essentiel */}
        <div className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
          <h3 className="text-lg font-bold">Essentiel</h3>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {essentiel ? (
              <>
                {fcfa(essentiel)}{" "}
                <span className="text-base font-bold text-muted-foreground">{SUFFIXE[periode]}</span>
              </>
            ) : (
              <span className="text-base font-bold text-muted-foreground">Non proposé sur cette période</span>
            )}
          </p>
          <p className="min-h-10 text-sm text-muted-foreground">{detail(essentiel)}</p>

          <ul className="mt-4 space-y-2 text-sm">
            {ARGUMENTAIRE.ESSENTIEL.inclus.map((l) => (
              <li key={l} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" /> {l}
              </li>
            ))}
            {/* Ce qui n'y est pas se dit aussi. Un commerçant qui découvre l'absence après avoir
                payé se sent trompé, et il a raison. */}
            {ARGUMENTAIRE.ESSENTIEL.exclus.map((l) => (
              <li key={l} className="flex gap-2 text-muted-foreground">
                <Minus size={16} className="mt-0.5 shrink-0" /> {l}
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

        {/* Premium */}
        <div className="relative rounded-xl border-2 border-primary bg-card p-6 shadow-sm transition-transform duration-300 lg:-translate-y-2 lg:hover:-translate-y-3">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            Le plus choisi
          </span>
          <h3 className="mt-3 text-lg font-bold">Premium</h3>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {premium ? (
              <>
                {fcfa(premium)}{" "}
                <span className="text-base font-bold text-muted-foreground">{SUFFIXE[periode]}</span>
              </>
            ) : (
              <span className="text-base font-bold text-muted-foreground">Non proposé sur cette période</span>
            )}
          </p>
          <p className="min-h-10 text-sm text-muted-foreground">{detail(premium)}</p>

          <ul className="mt-4 space-y-2 text-sm">
            {ARGUMENTAIRE.PREMIUM.inclus.map((l) => (
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

        {/* Entreprise */}
        <div className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
          <h3 className="text-lg font-bold">Entreprise</h3>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {entreprise ? (
              <>
                {fcfa(entreprise)} <span className="text-base font-bold text-muted-foreground">/ an</span>
              </>
            ) : (
              <span className="text-base font-bold text-muted-foreground">Sur devis</span>
            )}
          </p>
          <p className="min-h-10 text-sm text-muted-foreground">
            {entreprise ? "À partir de — tarif sur devis selon le nombre de boutiques." : "Tarif sur devis."}
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            {ARGUMENTAIRE.ENTREPRISE.inclus.map((l) => (
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
