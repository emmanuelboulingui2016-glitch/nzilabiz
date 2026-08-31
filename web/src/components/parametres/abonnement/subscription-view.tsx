"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { Building2, CheckCircle2, MessageCircle, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ContactSupport, lienWhatsapp } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { formatFcfa } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Plan = "ESSAI" | "PREMIUM" | "ENTREPRISE";

const PLAN_LABEL: Record<Plan, string> = {
  ESSAI: "Essai gratuit",
  PREMIUM: "Premium",
  ENTREPRISE: "Entreprise",
};

type Cycle = "mensuel" | "trimestriel" | "annuel";

const CYCLE_LABEL: Record<Cycle, string> = {
  mensuel: "35 000 FCFA / mois",
  trimestriel: "95 000 FCFA / trimestre (≈10 % de remise)",
  annuel: "350 000 FCFA / an (≈17 % de remise)",
};

const CYCLE_AMOUNT: Record<Cycle, number> = {
  mensuel: 35000,
  trimestriel: 95000,
  annuel: 350000,
};

export function SubscriptionView({
  plan,
  essaiExpireLe,
  abonnementExpireLe,
  contact,
}: {
  plan: Plan;
  essaiExpireLe: string | null;
  abonnementExpireLe: string | null;
  contact: ContactCommercial;
}) {
  const [chooseCycle, setChooseCycle] = useState<Cycle | null>(null);
  const [mobileMoneyStub, setMobileMoneyStub] = useState<{ cycle: Cycle } | null>(null);

  const expiryDate = plan === "ESSAI" ? essaiExpireLe : abonnementExpireLe;
  const daysRemaining = useMemo(() => {
    if (!expiryDate) return null;
    return differenceInCalendarDays(new Date(expiryDate), new Date());
  }, [expiryDate]);

  const planTone = plan === "PREMIUM" ? "success" : plan === "ENTREPRISE" ? "info" : "warning";

  // Le lien WhatsApp portait un message mais aucun destinataire : `wa.me` sans numéro ouvre le
  // sélecteur de contacts du téléphone, et le commerçant se retrouvait à devoir deviner à qui
  // écrire. Le numéro vient désormais des réglages de la plateforme ; sans numéro publié, on
  // propose les autres coordonnées plutôt qu'un bouton qui ne mène nulle part.
  const whatsappPremium = (cycle: Cycle) =>
    lienWhatsapp(
      contact,
      `Bonjour, je souhaite souscrire au plan Premium NzilaBiz (${CYCLE_LABEL[cycle]}, ${formatFcfa(
        CYCLE_AMOUNT[cycle]
      )}). Pouvez-vous m'aider à finaliser le paiement ?`
    );

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>Votre abonnement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={planTone as any} className="text-sm">
              {PLAN_LABEL[plan]}
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
              <span className="text-sm text-muted-foreground">Aucune date d&apos;expiration d&apos;essai enregistrée.</span>
            )}
          </div>
          {plan === "ESSAI" && (
            <p className="text-sm text-muted-foreground">
              Vous êtes sur l&apos;essai gratuit de 15 jours, sans carte bancaire. Choisissez un plan ci-dessous pour
              continuer sans interruption.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Premium */}
        <Card className={cn(plan === "PREMIUM" && "ring-2 ring-primary")}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Premium</CardTitle>
            <p className="text-xs text-muted-foreground">
              Produits/ventes illimités, utilisateurs illimités (patron, gérants, vendeurs), mode hors-ligne
              complet, rapports avancés, support prioritaire WhatsApp.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {(["mensuel", "trimestriel", "annuel"] as Cycle[]).map((cycle) => (
                <li key={cycle} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-primary" />
                    {CYCLE_LABEL[cycle]}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setChooseCycle(cycle)}>
                    Choisir
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Entreprise */}
        <Card className={cn(plan === "ENTREPRISE" && "ring-2 ring-primary")}>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Entreprise</CardTitle>
            <p className="text-xs text-muted-foreground">
              Gestion multi-boutiques, utilisateurs illimités, support dédié, formation des équipes incluse.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">À partir de {formatFcfa(700000)} / an</p>
            <p className="text-xs text-muted-foreground">Tarif sur devis selon le nombre de boutiques et de volumes.</p>
            {plan === "ENTREPRISE" ? (
              <Link
                href="/boutiques"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-95"
              >
                <Building2 size={16} />
                Gérer mes boutiques
              </Link>
            ) : (
              <ContactSupport contact={contact} sujet="Demande de formule Entreprise" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog : choix du mode de paiement pour Premium */}
      <Dialog
        open={chooseCycle !== null}
        onClose={() => setChooseCycle(null)}
        title={chooseCycle ? `Passer à Premium — ${CYCLE_LABEL[chooseCycle]}` : undefined}
      >
        {chooseCycle && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Montant : <strong>{formatFcfa(CYCLE_AMOUNT[chooseCycle])}</strong>. Choisissez comment finaliser votre
              abonnement.
            </p>
            <div className="grid gap-2">
              <Button
                variant="primary"
                className="justify-start"
                onClick={() => {
                  setMobileMoneyStub({ cycle: chooseCycle });
                  setChooseCycle(null);
                }}
              >
                <Smartphone size={16} />
                Payer par Mobile Money
              </Button>
              {whatsappPremium(chooseCycle) ? (
                <a
                  href={whatsappPremium(chooseCycle)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-start gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle size={16} />
                  Nous contacter via WhatsApp
                </a>
              ) : (
                <ContactSupport contact={contact} sujet="Souscription à la formule Premium" />
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Dialog : stub Mobile Money — pas d'agrégateur configuré dans ce build */}
      <Dialog
        open={mobileMoneyStub !== null}
        onClose={() => setMobileMoneyStub(null)}
        title="Paiement Mobile Money"
      >
        {mobileMoneyStub && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Le paiement Mobile Money sera activé dès que les identifiants de l&apos;agrégateur (CinetPay ou
              équivalent) seront configurés — contactez le support pour l&apos;instant. Aucun paiement n&apos;a été
              effectué.
            </p>
            {whatsappPremium(mobileMoneyStub.cycle) ? (
              <a
                href={whatsappPremium(mobileMoneyStub.cycle)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-start gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                <MessageCircle size={16} />
                Nous contacter via WhatsApp en attendant
              </a>
            ) : (
              <ContactSupport contact={contact} sujet="Paiement de l'abonnement Premium" />
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
