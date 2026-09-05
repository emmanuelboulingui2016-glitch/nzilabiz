"use client";

// Formule Entreprise négociée boutique par boutique — le prix n'est plus public (voir
// `src/components/public/pricing.tsx`) : c'est ici, et seulement ici, qu'il existe. Fixer un tarif
// active la formule et émet une demande de paiement ; confirmer un paiement reçu prolonge
// l'abonnement — la prolongation elle-même vit dans `confirmerPaiement`
// (`src/lib/paiements.ts`), jamais réécrite ici.

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import { calculerPeriode, CYCLES, LIBELLE_CYCLE, type Cycle } from "@/lib/tarifs";

export type DemandePaiementLigne = {
  id: string;
  plan: string;
  cycle: string;
  montant: number;
  devise: string;
  periodeDebut: string;
  periodeFin: string;
  statut: "EN_ATTENTE" | "PAYEE" | "EXPIREE" | "ANNULEE";
  creeLe: string;
  emisePar: string | null;
  confirmeeLe: string | null;
  confirmeeSource: string | null;
  confirmeePar: string | null;
};

const TON_STATUT: Record<DemandePaiementLigne["statut"], "warning" | "success" | "neutral" | "danger"> = {
  EN_ATTENTE: "warning",
  PAYEE: "success",
  EXPIREE: "neutral",
  ANNULEE: "danger",
};

const LIBELLE_STATUT: Record<DemandePaiementLigne["statut"], string> = {
  EN_ATTENTE: "En attente",
  PAYEE: "Payée",
  EXPIREE: "Expirée",
  ANNULEE: "Annulée",
};

function dateCourte(iso: string) {
  return format(parseISO(iso), "d MMM yyyy", { locale: fr });
}

export function FormuleEntreprise({
  storeId,
  plan,
  devise,
  abonnementExpireLe,
  tarifNegocie,
  demandesPaiement,
  onChanged,
}: {
  storeId: string;
  plan: string;
  devise: string;
  abonnementExpireLe: string | null;
  tarifNegocie: { montant: number | null; cycle: string | null; fixeLe: string | null; fixePar: string | null };
  demandesPaiement: DemandePaiementLigne[];
  onChanged: () => void;
}) {
  const [montant, setMontant] = useState(tarifNegocie.montant ? String(tarifNegocie.montant) : "");
  const [cycle, setCycle] = useState<Cycle>((tarifNegocie.cycle as Cycle) || "annuel");
  const [etapeConfirmation, setEtapeConfirmation] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [confirmationEnCours, setConfirmationEnCours] = useState<string | null>(null);

  const montantNombre = Number(montant.replace(/[^\d]/g, ""));
  const valide = montantNombre > 0 && CYCLES.includes(cycle);

  // Aperçu de la période facturée — même fonction pure que le serveur (`calculerPeriode`), pour
  // annoncer exactement la date qui sera écrite si l'administrateur confirme.
  const apercu = valide
    ? calculerPeriode(cycle, abonnementExpireLe ? new Date(abonnementExpireLe) : null, new Date())
    : null;

  async function fixerTarif() {
    setOccupe(true);
    try {
      const res = await fetch(`/api/superadmin/boutiques/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarifEntrepriseMontant: montantNombre, tarifEntrepriseCycle: cycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Action impossible.");
        return;
      }
      toast.success(
        `Formule Entreprise activée — demande de paiement de ${formatFcfa(montantNombre, devise)} émise.`
      );
      setEtapeConfirmation(false);
      onChanged();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  async function confirmerPaiement(demandeId: string) {
    setOccupe(true);
    try {
      const res = await fetch(`/api/superadmin/paiements/${demandeId}/confirmer`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Confirmation impossible.");
        return;
      }
      toast.success(
        data.dejaConfirmee
          ? "Ce paiement était déjà confirmé."
          : `Paiement confirmé — abonnement prolongé jusqu'au ${dateCourte(data.demande.periodeFin)}.`
      );
      setConfirmationEnCours(null);
      onChanged();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  const demandeEnAttente = demandesPaiement.find((d) => d.statut === "EN_ATTENTE") ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Building2 size={16} className="text-primary" />
        Formule Entreprise
      </p>
      <p className="text-xs text-muted-foreground">
        Son prix n&apos;est plus public : négociez-le de vive voix, puis fixez-le ici. Cela active la
        formule pour cette boutique et émet une demande de paiement.
      </p>

      {tarifNegocie.montant ? (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          Tarif en dossier : <strong>{formatFcfa(tarifNegocie.montant, devise)}</strong>
          {tarifNegocie.cycle ? ` / ${LIBELLE_CYCLE[tarifNegocie.cycle as Cycle] ?? tarifNegocie.cycle}` : ""}
          {tarifNegocie.fixeLe ? (
            <>
              {" — fixé"}
              {tarifNegocie.fixePar ? ` par ${tarifNegocie.fixePar}` : ""} le {dateCourte(tarifNegocie.fixeLe)}
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Aucun tarif négocié pour l&apos;instant.</p>
      )}

      {demandeEnAttente ? (
        <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-foreground">
          Une demande de paiement de{" "}
          <strong>{formatFcfa(demandeEnAttente.montant, demandeEnAttente.devise)}</strong> est en attente
          (période du {dateCourte(demandeEnAttente.periodeDebut)} au {dateCourte(demandeEnAttente.periodeFin)}).
          Fixer un nouveau tarif l&apos;annulera et en émettra une autre.
        </p>
      ) : null}

      {!etapeConfirmation ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Label htmlFor="sa-tarif-montant" className="text-xs">
              Montant négocié (FCFA)
            </Label>
            <Input
              id="sa-tarif-montant"
              inputMode="numeric"
              value={montant}
              onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="500 000"
              className="h-9"
            />
          </div>
          <div className="w-36">
            <Label htmlFor="sa-tarif-cycle" className="text-xs">
              Périodicité
            </Label>
            <Select
              id="sa-tarif-cycle"
              value={cycle}
              onChange={(e) => setCycle(e.target.value as Cycle)}
              className="h-9"
            >
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {LIBELLE_CYCLE[c]}
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" variant="outline" disabled={!valide} onClick={() => setEtapeConfirmation(true)}>
            {plan === "ENTREPRISE" ? "Mettre à jour le tarif" : "Activer Entreprise avec ce tarif"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p>
            {plan === "ENTREPRISE" ? "Ceci va mettre à jour le tarif de" : "Ceci va activer la formule Entreprise pour"}{" "}
            cette boutique à <strong>{formatFcfa(montantNombre, devise)}</strong> / {LIBELLE_CYCLE[cycle].toLowerCase()},
            et émettre une demande de paiement pour la période du{" "}
            <strong>{apercu ? dateCourte(apercu.debut.toISOString()) : "—"}</strong> au{" "}
            <strong>{apercu ? dateCourte(apercu.fin.toISOString()) : "—"}</strong>.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEtapeConfirmation(false)} disabled={occupe}>
              Annuler
            </Button>
            <Button size="sm" onClick={fixerTarif} disabled={occupe}>
              {occupe ? "Enregistrement..." : "Confirmer"}
            </Button>
          </div>
        </div>
      )}

      {demandesPaiement.length > 0 ? (
        <div className="pt-1">
          <p className="mb-1.5 text-xs font-bold text-muted-foreground">Demandes de paiement</p>
          <ul className="space-y-1.5">
            {demandesPaiement.map((d) => (
              <li key={d.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    {formatFcfa(d.montant, d.devise)} — {dateCourte(d.periodeDebut)} au {dateCourte(d.periodeFin)}
                  </span>
                  <Badge tone={TON_STATUT[d.statut]}>{LIBELLE_STATUT[d.statut]}</Badge>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  Émise{d.emisePar ? ` par ${d.emisePar}` : ""} le {dateCourte(d.creeLe)}
                  {d.statut === "PAYEE" && d.confirmeeLe
                    ? ` — confirmée${d.confirmeePar ? ` par ${d.confirmeePar}` : ""} le ${dateCourte(d.confirmeeLe)}${
                        d.confirmeeSource === "AGREGATEUR" ? " (agrégateur)" : " (manuelle)"
                      }`
                    : ""}
                </p>

                {d.statut === "EN_ATTENTE" ? (
                  confirmationEnCours === d.id ? (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-success/40 bg-success/5 p-2">
                      <p>
                        Confirmer avoir reçu {formatFcfa(d.montant, d.devise)} ? L&apos;abonnement sera prolongé
                        jusqu&apos;au {dateCourte(d.periodeFin)}.
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmationEnCours(null)}
                          disabled={occupe}
                        >
                          Annuler
                        </Button>
                        <Button size="sm" onClick={() => confirmerPaiement(d.id)} disabled={occupe}>
                          <CheckCircle2 size={14} />
                          {occupe ? "Confirmation..." : "Confirmer le paiement reçu"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => setConfirmationEnCours(d.id)}
                      disabled={occupe}
                    >
                      Confirmer le paiement reçu
                    </Button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
