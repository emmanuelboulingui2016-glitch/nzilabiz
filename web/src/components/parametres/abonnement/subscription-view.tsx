"use client";

// Écran Abonnement — ce que couvre la formule en cours, et ce que les autres apportent.
//
// Les montants viennent de la grille tarifaire modifiable depuis l'administration, et les listes
// de fonctionnalités de `lib/formules.ts`, le fichier qui décide réellement de ce qui est ouvert.
// C'était auparavant deux listes écrites à la main — ici et sur le site public — qu'aucun mécanisme
// n'obligeait à correspondre à ce que l'application faisait vraiment.

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { Building2, Check, Minus, MessageCircle, Smartphone } from "lucide-react";
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

const SUFFIXE: Record<Cycle, string> = { mensuel: "par mois", trimestriel: "par trimestre", annuel: "par an" };

const PLANS: PlanTarife[] = ["ESSENTIEL", "PREMIUM", "ENTREPRISE"];

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
    <div className="space-y-4 pb-20 md:pb-0">
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

      <div className="inline-flex rounded-full bg-muted p-1">
        {CYCLES.map((c) => (
          <button
            key={c}
            onClick={() => setPeriode(c)}
            aria-pressed={periode === c}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
              periode === c ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            )}
          >
            {LIBELLE_CYCLE[c]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const actuel = plan === p;
          const entreprise = p === "ENTREPRISE";
          // Entreprise ne se propose qu'à l'année, sur devis : son prix dépend du nombre de boutiques.
          const montant = entreprise ? grille.ENTREPRISE.annuel : grille[p][periode];
          const parMois = montant && !entreprise ? Math.round(montant / MOIS_PAR_CYCLE[periode]) : null;

          return (
            <Card key={p} className={cn(actuel && "ring-2 ring-primary")}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base font-semibold text-foreground">{LIBELLE_FORMULE[p]}</CardTitle>
                  {actuel ? (
                    <Badge tone="success" className="text-xs">
                      Votre formule
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {montant ? (
                    <>
                      {formatFcfa(montant)}{" "}
                      <span className="text-sm font-bold text-muted-foreground">
                        {entreprise ? "par an" : SUFFIXE[periode]}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">
                      {entreprise ? "Sur devis" : "Non proposé sur cette période"}
                    </span>
                  )}
                </p>
                <p className="min-h-8 text-xs text-muted-foreground">
                  {entreprise
                    ? "À partir de — selon le nombre de boutiques."
                    : parMois && periode !== "mensuel"
                      ? `Soit ${formatFcfa(parMois)} par mois.`
                      : "Sans engagement."}
                </p>
              </CardHeader>

              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm">
                  {ARGUMENTAIRE[p].inclus.map((l) => (
                    <li key={l} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                      {l}
                    </li>
                  ))}
                  {/* Ce qui n'est pas compris se dit aussi : un commerçant qui le découvre après
                      avoir payé se sent trompé, et il a raison. */}
                  {ARGUMENTAIRE[p].exclus.map((l) => (
                    <li key={l} className="flex items-start gap-2 text-muted-foreground">
                      <Minus size={15} className="mt-0.5 shrink-0" />
                      {l}
                    </li>
                  ))}
                </ul>

                {actuel && entreprise ? (
                  <Link href="/boutiques" className="block">
                    <Button size="sm" className="w-full">
                      <Building2 size={16} />
                      Gérer mes boutiques
                    </Button>
                  </Link>
                ) : entreprise ? (
                  <ContactSupport contact={contact} sujet="Demande de formule Entreprise" />
                ) : actuel ? (
                  <p className="text-xs text-muted-foreground">C&apos;est la formule active sur cette boutique.</p>
                ) : montant ? (
                  <Button
                    size="sm"
                    variant={p === "PREMIUM" ? "primary" : "outline"}
                    className="w-full"
                    onClick={() => setSouscription({ plan: p, montant })}
                  >
                    Choisir {LIBELLE_FORMULE[p]}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
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
