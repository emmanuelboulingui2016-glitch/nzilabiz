"use client";

// Boîte de réception des demandes d'assistance.

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Inbox, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";

type Ticket = {
  id: string;
  sujet: string;
  message: string;
  statut: "OUVERT" | "EN_COURS" | "RESOLU" | "FERME";
  reponse: string | null;
  reponduParEmail: string | null;
  reponduLe: string | null;
  auteur: { nom: string; email: string };
  boutique: { id: string; nom: string; plan: string };
  creeLe: string;
};

const TON_STATUT = {
  OUVERT: "danger",
  EN_COURS: "warning",
  RESOLU: "success",
  FERME: "neutral",
} as const;

const LABEL_STATUT = {
  OUVERT: "Ouverte",
  EN_COURS: "En cours",
  RESOLU: "Résolue",
  FERME: "Fermée",
} as const;

export function SupportInbox() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<"TOUS" | Ticket["statut"]>("OUVERT");
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch(`/api/superadmin/support?statut=${filtre}`);
      if (!res.ok) throw new Error("chargement");
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {
      toast.error("Impossible de charger les demandes.");
    } finally {
      setChargement(false);
    }
  }, [filtre]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function appliquer(id: string, corps: Record<string, unknown>, succes: string) {
    setOccupe(id);
    try {
      const res = await fetch("/api/superadmin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...corps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Action impossible.");
        return;
      }
      toast.success(succes);
      setBrouillons((b) => ({ ...b, [id]: "" }));
      charger();
    } finally {
      setOccupe(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Support</h1>
        <p className="text-sm text-muted-foreground">
          Les demandes envoyées par les commerçants depuis l&apos;application.
        </p>
      </div>

      <Tabs
        value={filtre}
        onChange={(v) => setFiltre(v as typeof filtre)}
        tabs={[
          { value: "OUVERT", label: "Ouvertes" },
          { value: "EN_COURS", label: "En cours" },
          { value: "RESOLU", label: "Résolues" },
          { value: "TOUS", label: "Toutes" },
        ]}
      />

      {chargement ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox size={28} className="text-muted-foreground" />
            <p className="text-sm font-semibold">Aucune demande</p>
            <p className="text-sm text-muted-foreground">
              {filtre === "OUVERT"
                ? "Rien en attente — tout est traité."
                : "Aucune demande dans cette catégorie."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{t.sujet}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.auteur.nom} ({t.auteur.email}) · {t.boutique.nom} · {t.boutique.plan} ·{" "}
                      {format(parseISO(t.creeLe), "d MMM yyyy, HH:mm", { locale: fr })}
                    </p>
                  </div>
                  <Badge tone={TON_STATUT[t.statut]}>{LABEL_STATUT[t.statut]}</Badge>
                </div>

                <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{t.message}</p>

                {t.reponse ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs font-bold text-primary">
                      Réponse envoyée{" "}
                      {t.reponduLe ? format(parseISO(t.reponduLe), "le d MMM yyyy à HH:mm", { locale: fr }) : ""}
                      {t.reponduParEmail ? ` par ${t.reponduParEmail}` : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{t.reponse}</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Textarea
                    value={brouillons[t.id] ?? ""}
                    onChange={(e) => setBrouillons((b) => ({ ...b, [t.id]: e.target.value }))}
                    placeholder={t.reponse ? "Modifier la réponse..." : "Écrire une réponse..."}
                    className="min-h-16"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Select
                      value={t.statut}
                      onChange={(e) => appliquer(t.id, { statut: e.target.value }, "Statut mis à jour.")}
                      className="h-9 w-auto"
                      aria-label="Statut"
                      disabled={occupe === t.id}
                    >
                      <option value="OUVERT">Ouverte</option>
                      <option value="EN_COURS">En cours</option>
                      <option value="RESOLU">Résolue</option>
                      <option value="FERME">Fermée</option>
                    </Select>
                    <Button
                      size="sm"
                      disabled={occupe === t.id || !(brouillons[t.id] ?? "").trim()}
                      onClick={() =>
                        appliquer(t.id, { reponse: brouillons[t.id] }, "Réponse enregistrée.")
                      }
                    >
                      <Send size={14} /> Répondre
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
