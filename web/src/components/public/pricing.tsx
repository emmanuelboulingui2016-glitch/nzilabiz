"use client";

// Bloc tarifs de la vitrine — même grille que l'écran Abonnement de l'application.
//
// Trois colonnes, celle du milieu décollée et pleine, un pictogramme par formule, un prix
// dominant, une liste cochée, un bouton pleine largeur en pilule. La structure est celle d'une
// page tarifs classique ; les couleurs restent celles de NzilaBiz — émeraude sur crème, Manrope.
//
// Les montants ne sont plus écrits ici. Ils viennent de la grille tarifaire modifiable depuis
// l'administration : ce composant et l'écran Abonnement affichaient auparavant deux copies du même
// prix, qui pouvaient diverger sans que rien ne le signale.
//
// L'essai n'a plus sa colonne. Il ne s'oppose pas aux formules, il les précède toutes : en faire
// une quatrième carte laissait croire qu'il fallait choisir entre « essai » et « premium », et
// réduisait la place des offres réellement payantes.

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, Minus, Sparkles, Store } from "lucide-react";
import { ContactSupport } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { ARGUMENTAIRE } from "@/lib/formules";
import {
  CYCLES,
  LIBELLE_CYCLE,
  MOIS_PAR_CYCLE,
  economiePourcent,
  type Cycle,
  type Grille,
  type PlanTarife,
} from "@/lib/tarifs";
import { cn } from "@/lib/utils";

const SUFFIXE: Record<Cycle, string> = { mensuel: "/ mois", trimestriel: "/ trimestre", annuel: "/ an" };

const PLANS: PlanTarife[] = ["ESSENTIEL", "PREMIUM", "ENTREPRISE"];

const LIBELLE_PLAN: Record<PlanTarife, string> = {
  ESSENTIEL: "Essentiel",
  PREMIUM: "Premium",
  ENTREPRISE: "Entreprise",
};

const ICONE: Record<PlanTarife, ComponentType<{ size?: number; className?: string }>> = {
  ESSENTIEL: Store,
  PREMIUM: Sparkles,
  ENTREPRISE: Building2,
};

function nombre(montant: number) {
  return Math.round(montant).toLocaleString("fr-FR").replace(/ | /g, " ");
}

function Coche({ vedette }: { vedette: boolean }) {
  return (
    <span
      className={cn(
        "mt-px flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md",
        vedette ? "bg-white/25" : "bg-primary"
      )}
    >
      <Check size={12} strokeWidth={3.5} className={vedette ? "text-white" : "text-primary-foreground"} />
    </span>
  );
}

function Croix({ vedette }: { vedette: boolean }) {
  return (
    <span
      className={cn(
        "mt-px flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-md",
        vedette ? "bg-white/10" : "bg-muted"
      )}
    >
      <Minus size={12} strokeWidth={3} className="opacity-70" />
    </span>
  );
}

export function Pricing({ contact, grille }: { contact: ContactCommercial; grille: Grille }) {
  const [periode, setPeriode] = useState<Cycle>("annuel");

  return (
    <>
      {/* L'essai est annoncé par la section qui enveloppe ce bloc : le répéter ici faisait deux
          fois la même phrase à trois lignes d'intervalle. */}
      <div className="mt-7 inline-flex rounded-full bg-muted p-1">
        {CYCLES.map((c) => {
          const remise = economiePourcent(grille, "PREMIUM", c);
          return (
            <button
              key={c}
              onClick={() => setPeriode(c)}
              aria-pressed={periode === c}
              className={cn(
                // py-3 plutôt que py-2 : à cette taille de texte, py-2 laissait une zone tactile
                // sous les 44 px recommandés — un doigt rate facilement le bouton sur mobile.
                "relative rounded-full px-4 py-3 text-sm font-bold transition-colors sm:px-5",
                periode === c
                  ? "bg-primary text-primary-foreground shadow-carte"
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

      {/* La carte du milieu est décollée : il lui faut de la place au-dessus et en dessous. */}
      <div className="mt-9 grid items-start gap-6 text-left lg:grid-cols-3 lg:gap-6 lg:py-4">
        {PLANS.map((p) => {
          const entreprise = p === "ENTREPRISE";
          const montant = entreprise ? grille.ENTREPRISE.annuel : grille[p][periode];
          const parMois = montant && !entreprise ? Math.round(montant / MOIS_PAR_CYCLE[periode]) : null;
          const vedette = p === "PREMIUM";
          const Icone = ICONE[p];

          return (
            <article
              key={p}
              className={cn(
                "relative flex flex-col rounded-[1.5rem] p-6 transition-shadow sm:p-7",
                vedette
                  ? "bg-primary text-primary-foreground shadow-vedette lg:-translate-y-4"
                  : "bg-card shadow-carte hover:shadow-relief"
              )}
            >
              {vedette ? (
                <span className="mb-4 self-start rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                  Le plus choisi
                </span>
              ) : null}

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    vedette ? "bg-white/15" : "bg-primary/10"
                  )}
                >
                  <Icone size={20} className={vedette ? "text-white" : "text-primary"} />
                </span>
                <h3 className="titre-serif text-2xl">{LIBELLE_PLAN[p]}</h3>
              </div>

              <p className="titre-serif mt-6 text-4xl tabular-nums">
                {montant ? (
                  <>
                    {nombre(montant)}
                    <span
                      className={cn(
                        "ml-1.5 text-base font-bold",
                        vedette ? "text-white/70" : "text-muted-foreground"
                      )}
                    >
                      FCFA {entreprise ? "/ an" : SUFFIXE[periode]}
                    </span>
                  </>
                ) : (
                  <span className={cn("text-base font-bold", vedette ? "text-white/70" : "text-muted-foreground")}>
                    {entreprise ? "Sur devis" : "Non proposé sur cette période"}
                  </span>
                )}
              </p>

              <p className={cn("mt-2 min-h-10 text-sm", vedette ? "text-white/75" : "text-muted-foreground")}>
                {entreprise
                  ? "À partir de — tarif sur devis selon le nombre de boutiques."
                  : parMois && periode !== "mensuel"
                    ? `Soit ${nombre(parMois)} FCFA par mois.`
                    : ARGUMENTAIRE[p].resume}
              </p>

              <hr className={cn("my-6 border-t", vedette ? "border-white/20" : "border-border")} />

              <ul className="flex-1 space-y-3 text-sm">
                {ARGUMENTAIRE[p].inclus.map((l) => (
                  <li key={l} className="flex items-start gap-2.5">
                    <Coche vedette={vedette} />
                    <span className={vedette ? "font-medium" : ""}>{l}</span>
                  </li>
                ))}
                {/* Ce qui n'y est pas se dit aussi. Un commerçant qui découvre l'absence après
                    avoir payé se sent trompé, et il a raison. */}
                {ARGUMENTAIRE[p].exclus.map((l) => (
                  <li
                    key={l}
                    className={cn("flex items-start gap-2.5", vedette ? "text-white/60" : "text-muted-foreground")}
                  >
                    <Croix vedette={vedette} />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                {entreprise ? (
                  <ContactSupport contact={contact} sujet="Demande de formule Entreprise" />
                ) : (
                  <Link
                    href="/inscription"
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90",
                      vedette ? "bg-white text-primary" : "bg-primary text-primary-foreground"
                    )}
                  >
                    Démarrer l&apos;essai
                    <ArrowRight size={16} />
                  </Link>
                )}

                <p
                  className={cn("mt-3 text-center text-xs", vedette ? "text-white/70" : "text-muted-foreground")}
                >
                  {entreprise ? "Nous répondons dans la journée" : "Aucune carte bancaire demandée"}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
