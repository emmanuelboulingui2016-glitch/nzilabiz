"use client";

// Écran Abonnement — ce que couvre la formule en cours, et ce que les autres apportent.
//
// La mise en page reprend la structure d'une grille tarifaire classique : trois colonnes, celle du
// milieu mise en avant, un pictogramme par formule, un prix dominant, une liste cochée, un bouton
// pleine largeur. Les couleurs, elles, restent celles de NzilaBiz — émeraude, forêt, crème,
// Manrope : c'est la structure qui est reprise du modèle, pas sa palette bleue.
//
// Les montants viennent de la grille tarifaire modifiable depuis l'administration, et les listes
// de fonctionnalités de `lib/formules.ts`, le fichier qui décide réellement de ce qui est ouvert.
// C'étaient auparavant deux listes écrites à la main — ici et sur le site public — qu'aucun
// mécanisme n'obligeait à correspondre à ce que l'application faisait vraiment.

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import {
  ArrowRight,
  Building2,
  Check,
  MessageCircle,
  Minus,
  Smartphone,
  Sparkles,
  Store,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ContactSupport, lienWhatsapp } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { ARGUMENTAIRE, LIBELLE_FORMULE, type Formule } from "@/lib/formules";
import { CYCLES, LIBELLE_CYCLE, MOIS_PAR_CYCLE, type Cycle, type Grille, type PlanTarife } from "@/lib/tarifs";
import { formatFcfa } from "@/lib/currency";
import { cn } from "@/lib/utils";

const SUFFIXE: Record<Cycle, string> = { mensuel: "/ mois", trimestriel: "/ trimestre", annuel: "/ an" };

const PLANS: PlanTarife[] = ["ESSENTIEL", "PREMIUM", "ENTREPRISE"];

const ICONE: Record<PlanTarife, ComponentType<{ size?: number; className?: string }>> = {
  ESSENTIEL: Store,
  PREMIUM: Sparkles,
  ENTREPRISE: Building2,
};

/** Montant sans le sigle : le « FCFA » est rendu à part, en plus petit, comme la périodicité. */
function nombre(montant: number) {
  return Math.round(montant).toLocaleString("fr-FR").replace(/ | /g, " ");
}

/** Coche du modèle : un carré plein, pas une simple icône — c'est ce qui donne le rythme visuel. */
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

export function SubscriptionView({
  plan,
  essaiExpireLe,
  abonnementExpireLe,
  contact,
  grille,
}: {
  plan: Formule;
  essaiExpireLe: string | null;
  abonnementExpireLe: string | null;
  contact: ContactCommercial;
  grille: Grille;
}) {
  const [periode, setPeriode] = useState<Cycle>("annuel");
  const [souscription, setSouscription] = useState<{ plan: PlanTarife; montant: number } | null>(null);
  const [mobileMoneyStub, setMobileMoneyStub] = useState<{ plan: PlanTarife; montant: number } | null>(null);

  const expiryDate = plan === "ESSAI" ? essaiExpireLe : abonnementExpireLe;
  const daysRemaining = useMemo(() => {
    if (!expiryDate) return null;
    return differenceInCalendarDays(new Date(expiryDate), new Date());
  }, [expiryDate]);

  const planTone = plan === "PREMIUM" ? "success" : plan === "ESSAI" ? "warning" : "info";

  // Le lien WhatsApp portait un message mais aucun destinataire : `wa.me` sans numéro ouvre le
  // sélecteur de contacts du téléphone, et le commerçant devait deviner à qui écrire. Le numéro
  // vient des réglages de la plateforme ; sans numéro publié, on propose les autres coordonnées
  // plutôt qu'un bouton qui ne mène nulle part.
  const whatsapp = (p: PlanTarife, montant: number) =>
    lienWhatsapp(
      contact,
      `Bonjour, je souhaite souscrire à la formule ${LIBELLE_FORMULE[p]} de NzilaBiz (${LIBELLE_CYCLE[
        periode
      ].toLowerCase()}, ${formatFcfa(montant)}). Pouvez-vous m'aider à finaliser le paiement ?`
    );

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* État de l'abonnement en cours */}
      <Card>
        <CardHeader>
          <CardTitle>Votre abonnement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={planTone} className="text-sm">
              {LIBELLE_FORMULE[plan]}
            </Badge>
            {daysRemaining !== null && (
              <span className="text-sm text-muted-foreground">
                {daysRemaining >= 0
                  ? `${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} restant${daysRemaining > 1 ? "s" : ""}`
                  : "Expiré"}
                {expiryDate ? ` (échéance le ${new Date(expiryDate).toLocaleDateString("fr-FR")})` : ""}
              </span>
            )}
            {expiryDate === null && plan === "ESSAI" && (
              <span className="text-sm text-muted-foreground">
                Aucune date d&apos;expiration d&apos;essai enregistrée.
              </span>
            )}
          </div>
          {plan === "ESSAI" && (
            <p className="text-sm text-muted-foreground">
              Vous êtes sur l&apos;essai gratuit de 15 jours, avec toutes les fonctionnalités. Choisissez une
              formule ci-dessous pour continuer sans interruption.
            </p>
          )}
          {plan === "ESSENTIEL" && (
            <p className="text-sm text-muted-foreground">
              Votre formule couvre la caisse, le stock, les clients et les créances. Premium ajoute les
              dépenses, les factures et les rapports.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Titre + sélecteur de périodicité, centrés comme sur une page tarifs */}
      <div className="text-center">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Nos formules</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Changez de formule à tout moment. Vos données sont conservées dans tous les cas.
        </p>

        <div className="mt-5 inline-flex rounded-full bg-muted p-1">
          {CYCLES.map((c) => (
            <button
              key={c}
              onClick={() => setPeriode(c)}
              aria-pressed={periode === c}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold transition-colors sm:px-5",
                periode === c
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {LIBELLE_CYCLE[c]}
            </button>
          ))}
        </div>
      </div>

      {/* La carte du milieu est décollée : il faut de la place au-dessus et en dessous. */}
      <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-5 lg:py-4">
        {PLANS.map((p) => {
          const actuel = plan === p;
          const entreprise = p === "ENTREPRISE";
          // Entreprise ne se propose qu'à l'année, sur devis : son prix dépend du nombre de boutiques.
          const montant = entreprise ? grille.ENTREPRISE.annuel : grille[p][periode];
          const parMois = montant && !entreprise ? Math.round(montant / MOIS_PAR_CYCLE[periode]) : null;
          const vedette = p === "PREMIUM";
          const Icone = ICONE[p];

          return (
            <article
              key={p}
              className={cn(
                "relative flex flex-col rounded-2xl p-6 transition-shadow sm:p-7",
                vedette
                  ? "bg-primary text-primary-foreground shadow-xl lg:-translate-y-4"
                  : "border border-border bg-card shadow-sm hover:shadow-md",
                actuel && !vedette && "ring-2 ring-primary"
              )}
            >
              {(vedette || actuel) && (
                <span
                  className={cn(
                    "mb-4 self-start rounded-full px-3 py-1 text-xs font-bold",
                    vedette ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  )}
                >
                  {actuel ? "Votre formule" : "Le plus choisi"}
                </span>
              )}

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    vedette ? "bg-white/15" : "bg-primary/10"
                  )}
                >
                  <Icone size={20} className={vedette ? "text-white" : "text-primary"} />
                </span>
                <h3 className="text-xl font-extrabold">{LIBELLE_FORMULE[p]}</h3>
              </div>

              <p className="mt-6 text-4xl font-extrabold tabular-nums">
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

              <p
                className={cn(
                  "mt-2 min-h-10 text-sm",
                  vedette ? "text-white/75" : "text-muted-foreground"
                )}
              >
                {entreprise
                  ? "À partir de — selon le nombre de boutiques."
                  : parMois && periode !== "mensuel"
                    ? `Soit ${formatFcfa(parMois)} par mois.`
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
                {/* Ce qui n'est pas compris se dit aussi : un commerçant qui le découvre après
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
                {actuel && entreprise ? (
                  <Link href="/boutiques" className="block">
                    <Button className="h-12 w-full rounded-full text-sm font-bold">
                      <Building2 size={16} />
                      Gérer mes boutiques
                    </Button>
                  </Link>
                ) : entreprise ? (
                  <ContactSupport contact={contact} sujet="Demande de formule Entreprise" />
                ) : actuel ? (
                  <p
                    className={cn(
                      "flex h-12 items-center justify-center rounded-full text-sm font-bold",
                      vedette ? "bg-white/15 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    Formule active
                  </p>
                ) : montant ? (
                  <button
                    onClick={() => setSouscription({ plan: p, montant })}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90",
                      vedette ? "bg-white text-primary" : "bg-primary text-primary-foreground"
                    )}
                  >
                    Choisir {LIBELLE_FORMULE[p]}
                    <ArrowRight size={16} />
                  </button>
                ) : null}

                <p
                  className={cn(
                    "mt-3 text-center text-xs",
                    vedette ? "text-white/70" : "text-muted-foreground"
                  )}
                >
                  {entreprise ? "Tarif sur devis, sans engagement" : "Sans engagement, résiliable à tout moment"}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Choix du moyen de paiement */}
      <Dialog
        open={souscription !== null}
        onClose={() => setSouscription(null)}
        title={
          souscription
            ? `Passer à ${LIBELLE_FORMULE[souscription.plan]} — ${formatFcfa(souscription.montant)} ${SUFFIXE[periode]}`
            : undefined
        }
      >
        {souscription && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Montant : <strong>{formatFcfa(souscription.montant)}</strong>. Choisissez comment finaliser votre
              abonnement.
            </p>
            <div className="grid gap-2">
              <Button
                variant="primary"
                className="justify-start"
                onClick={() => {
                  setMobileMoneyStub(souscription);
                  setSouscription(null);
                }}
              >
                <Smartphone size={16} />
                Payer par Mobile Money
              </Button>
              {whatsapp(souscription.plan, souscription.montant) ? (
                <a
                  href={whatsapp(souscription.plan, souscription.montant)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-start gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle size={16} />
                  Nous contacter via WhatsApp
                </a>
              ) : (
                <ContactSupport contact={contact} sujet={`Souscription — ${LIBELLE_FORMULE[souscription.plan]}`} />
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Mobile Money : aucun agrégateur n'est branché dans cette version, et on le dit. */}
      <Dialog open={mobileMoneyStub !== null} onClose={() => setMobileMoneyStub(null)} title="Paiement Mobile Money">
        {mobileMoneyStub && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Le paiement Mobile Money sera activé dès que les identifiants de l&apos;agrégateur (CinetPay ou
              équivalent) seront configurés — contactez le support pour l&apos;instant. Aucun paiement n&apos;a été
              effectué.
            </p>
            {whatsapp(mobileMoneyStub.plan, mobileMoneyStub.montant) ? (
              <a
                href={whatsapp(mobileMoneyStub.plan, mobileMoneyStub.montant)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-start gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                <MessageCircle size={16} />
                Nous contacter via WhatsApp en attendant
              </a>
            ) : (
              <ContactSupport contact={contact} sujet="Paiement de l'abonnement" />
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
