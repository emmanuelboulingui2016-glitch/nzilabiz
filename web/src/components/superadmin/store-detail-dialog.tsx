"use client";

// Fiche d'une boutique côté administration : son activité, son équipe, et les trois gestes
// d'exploitation courants — changer la formule, prolonger l'échéance, supprimer la boutique.

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";

type Detail = {
  boutique: {
    id: string;
    nom: string;
    telephone: string | null;
    adresse: string | null;
    ville: string | null;
    quartier: string | null;
    pays: string;
    typeCommerce: string | null;
    devise: string;
    plan: "ESSAI" | "PREMIUM" | "ENTREPRISE";
    creeLe: string;
    essaiExpireLe: string | null;
    abonnementExpireLe: string | null;
  };
  equipe: {
    id: string;
    nom: string;
    email: string;
    role: string;
    superAdmin: boolean;
    derniereConnexion: string | null;
    desactive: boolean;
    creeLe: string;
  }[];
  compteurs: { produits: number; clients: number; ventes: number; volume: number; depenses: number };
  dernieresVentes: { id: string; numero: string; total: number; dateHeure: string; statut: string }[];
};

export function StoreDetailDialog({
  storeId,
  onClose,
  onChanged,
}: {
  storeId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [chargement, setChargement] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [plan, setPlan] = useState<Detail["boutique"]["plan"]>("ESSAI");
  const [jours, setJours] = useState("30");
  const [confirmSuppression, setConfirmSuppression] = useState("");
  const [zoneDanger, setZoneDanger] = useState(false);

  const charger = useCallback(() => {
    if (!storeId) return;
    setChargement(true);
    fetch(`/api/superadmin/boutiques/${storeId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then((data: Detail) => {
        setDetail(data);
        setPlan(data.boutique.plan);
      })
      .catch(() => toast.error("Impossible de charger la fiche."))
      .finally(() => setChargement(false));
  }, [storeId]);

  useEffect(() => {
    setDetail(null);
    setZoneDanger(false);
    setConfirmSuppression("");
    charger();
  }, [charger]);

  async function appliquer(corps: Record<string, unknown>, succes: string) {
    if (!storeId) return;
    setOccupe(true);
    try {
      const res = await fetch(`/api/superadmin/boutiques/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Action impossible.");
        return;
      }
      toast.success(succes);
      charger();
      onChanged();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer() {
    if (!storeId || !detail) return;
    setOccupe(true);
    try {
      const res = await fetch(`/api/superadmin/boutiques/${storeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: confirmSuppression }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Suppression impossible.");
        return;
      }
      toast.success(`${detail.boutique.nom} supprimée.`);
      onChanged();
      onClose();
    } finally {
      setOccupe(false);
    }
  }

  const echeanceCourante =
    detail?.boutique.plan === "ESSAI" ? detail?.boutique.essaiExpireLe : detail?.boutique.abonnementExpireLe;

  return (
    <Dialog
      open={storeId !== null}
      onClose={onClose}
      title={detail?.boutique.nom ?? "Boutique"}
      className="max-w-3xl"
    >
      {chargement || !detail ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                detail.boutique.plan === "PREMIUM"
                  ? "success"
                  : detail.boutique.plan === "ENTREPRISE"
                    ? "info"
                    : "warning"
              }
            >
              {detail.boutique.plan}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Inscrite le {format(parseISO(detail.boutique.creeLe), "d MMMM yyyy", { locale: fr })} ·{" "}
              {echeanceCourante
                ? `échéance le ${format(parseISO(echeanceCourante), "d MMM yyyy", { locale: fr })}`
                : "sans échéance"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Ventes", valeur: String(detail.compteurs.ventes) },
              { label: "Volume", valeur: formatFcfa(detail.compteurs.volume) },
              { label: "Dépenses", valeur: formatFcfa(detail.compteurs.depenses) },
              { label: "Produits", valeur: String(detail.compteurs.produits) },
              { label: "Clients", valeur: String(detail.compteurs.clients) },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="mt-0.5 text-base font-bold tracking-tight">{c.valeur}</p>
              </div>
            ))}
          </div>

          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Localisation", [detail.boutique.quartier, detail.boutique.ville, detail.boutique.pays].filter(Boolean).join(", ") || "—"],
              ["Type de commerce", detail.boutique.typeCommerce ?? "—"],
              ["Téléphone", detail.boutique.telephone ?? "—"],
              ["Devise", detail.boutique.devise],
            ].map(([label, valeur]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-muted-foreground">{label} :</dt>
                <dd className="min-w-0 truncate font-medium">{valeur}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="mb-2 text-sm font-bold">Équipe ({detail.equipe.length})</p>
            <ul className="space-y-1">
              {detail.equipe.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {u.nom}
                      {u.superAdmin ? <ShieldCheck size={13} className="text-primary" /> : null}
                      {u.desactive ? <Badge tone="neutral">désactivé</Badge> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge tone="neutral">{u.role}</Badge>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {u.derniereConnexion
                        ? format(parseISO(u.derniereConnexion), "d MMM yyyy", { locale: fr })
                        : "jamais connecté"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {detail.dernieresVentes.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-bold">Dernières ventes</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {detail.dernieresVentes.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {format(parseISO(v.dateHeure), "d MMM yyyy, HH:mm", { locale: fr })} · {v.numero}
                      {v.statut === "ANNULEE" ? " · annulée" : ""}
                    </span>
                    <span className="font-semibold">{formatFcfa(v.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-bold">Administration de l&apos;abonnement</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40">
                <Label htmlFor="sa-plan" className="text-xs">
                  Formule
                </Label>
                <Select
                  id="sa-plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as Detail["boutique"]["plan"])}
                  className="h-9"
                >
                  <option value="ESSAI">Essai</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="ENTREPRISE">Entreprise</option>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={occupe || plan === detail.boutique.plan}
                onClick={() => appliquer({ plan }, "Formule mise à jour.")}
              >
                Changer la formule
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="w-32">
                <Label htmlFor="sa-jours" className="text-xs">
                  Prolonger de (jours)
                </Label>
                <Input
                  id="sa-jours"
                  type="number"
                  min={1}
                  max={730}
                  value={jours}
                  onChange={(e) => setJours(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button
                size="sm"
                disabled={occupe || !jours}
                onClick={() => appliquer({ prolongerJours: Number(jours) }, `Échéance prolongée de ${jours} jours.`)}
              >
                Prolonger
              </Button>
              <p className="text-xs text-muted-foreground">
                Prolonge l&apos;essai si la formule est Essai, sinon l&apos;abonnement. Une échéance déjà
                dépassée repart d&apos;aujourd&apos;hui.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-danger/40 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-danger">
              <AlertTriangle size={16} /> Zone de danger
            </p>
            {!zoneDanger ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Supprimer définitivement cette boutique et toutes ses données.
                </p>
                <Button size="sm" variant="outline" onClick={() => setZoneDanger(true)}>
                  Supprimer
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Produits, ventes, clients, documents et comptes de l&apos;équipe seront effacés. Cette
                  action est irréversible.
                </p>
                <Label htmlFor="sa-confirm" className="text-xs">
                  Saisissez <strong>{detail.boutique.nom}</strong> pour confirmer
                </Label>
                <Input
                  id="sa-confirm"
                  value={confirmSuppression}
                  onChange={(e) => setConfirmSuppression(e.target.value)}
                  className="h-9"
                  autoComplete="off"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setZoneDanger(false)} disabled={occupe}>
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={occupe || confirmSuppression !== detail.boutique.nom}
                    onClick={supprimer}
                  >
                    Supprimer définitivement
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
