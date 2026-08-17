"use client";

// Fiche client complète : coordonnées, fidélité, produits préférés et historique d'achats.
// C'est l'écran que le commerçant ouvre avant de relancer un client par WhatsApp.

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageCircle, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/currency";
import { SEGMENT_LABELS, SEGMENT_DESCRIPTIONS } from "@/lib/clients/loyalty";
import { toWhatsAppPhone } from "@/components/creances/types";
import { SEGMENT_TONES, type ClientAchat, type ClientFiche, type ClientTopProduit } from "./types";

export function ClientDetailDialog({
  clientId,
  canEdit,
  onClose,
  onEdit,
  onChanged,
}: {
  clientId: string | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (client: ClientFiche) => void;
  onChanged: () => void;
}) {
  const [client, setClient] = useState<ClientFiche | null>(null);
  const [historique, setHistorique] = useState<ClientAchat[]>([]);
  const [topProduits, setTopProduits] = useState<ClientTopProduit[]>([]);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(`/api/clients/${clientId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Chargement impossible"))))
      .then((data) => {
        setClient(data.client);
        setHistorique(data.historique ?? []);
        setTopProduits(data.topProduits ?? []);
      })
      .catch(() => toast.error("Impossible de charger la fiche client"))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function toggleArchive() {
    if (!client) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive: !client.archive }),
      });
      if (!res.ok) throw new Error("Échec de l'opération");
      toast.success(client.archive ? "Client réactivé" : "Client archivé");
      setClient({ ...client, archive: !client.archive });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setArchiving(false);
    }
  }

  const whatsapp = toWhatsAppPhone(client?.telephone);
  const relanceMessage = client
    ? encodeURIComponent(
        `Bonjour ${client.nom}, nous ne vous avons pas vu depuis un moment à la boutique. ` +
          `Nous avons de nouveaux articles, passez nous voir !`
      )
    : "";

  return (
    <Dialog
      open={clientId !== null}
      onClose={onClose}
      title={client?.nom ?? "Fiche client"}
      className="max-w-2xl"
    >
      {loading || !client ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={SEGMENT_TONES[client.segment]} title={SEGMENT_DESCRIPTIONS[client.segment]}>
              {SEGMENT_LABELS[client.segment]}
            </Badge>
            {client.archive ? <Badge tone="neutral">Archivé</Badge> : null}
            {client.soldeCreance > 0 ? (
              <Badge tone="danger">Doit {formatFcfa(client.soldeCreance)}</Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Achats" value={String(client.nbAchats)} />
            <Stat label="Chiffre d'affaires" value={formatFcfa(client.totalAchats)} />
            <Stat label="Panier moyen" value={formatFcfa(client.panierMoyen)} />
            <Stat
              label="Fréquence"
              value={client.frequenceJours !== null ? `${client.frequenceJours} j` : "—"}
            />
          </div>

          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="Téléphone" value={client.telephone} />
            <Field label="E-mail" value={client.email} />
            <Field label="Adresse" value={client.adresse} />
            <Field
              label="Client depuis"
              value={format(new Date(client.creeLe), "d MMMM yyyy", { locale: fr })}
            />
            <Field
              label="Premier achat"
              value={client.premierAchat ? format(new Date(client.premierAchat), "d MMM yyyy", { locale: fr }) : null}
            />
            <Field
              label="Dernier achat"
              value={
                client.dernierAchat
                  ? `${format(new Date(client.dernierAchat), "d MMM yyyy", { locale: fr })}` +
                    (client.joursDepuisDernierAchat !== null ? ` (il y a ${client.joursDepuisDernierAchat} j)` : "")
                  : null
              }
            />
          </dl>

          {client.notes ? (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="mb-1 font-semibold">Notes</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{client.notes}</p>
            </div>
          ) : null}

          {topProduits.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-bold">Ses produits préférés</p>
              <ul className="space-y-1">
                {topProduits.map((p) => (
                  <li key={p.productId} className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{p.nom}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.quantite} · {formatFcfa(p.montant)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-bold">Historique d&apos;achats</p>
            {historique.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun achat enregistré à son nom.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {historique.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {format(new Date(v.dateHeure), "d MMM yyyy, HH:mm", { locale: fr })} · {v.numero}
                    </span>
                    <span className="font-semibold">{formatFcfa(v.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}?text=${relanceMessage}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <MessageCircle size={16} /> Relancer par WhatsApp
                </Button>
              </a>
            ) : null}
            {canEdit ? (
              <>
                <Button variant="outline" size="sm" onClick={toggleArchive} disabled={archiving}>
                  {client.archive ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  {client.archive ? "Réactiver" : "Archiver"}
                </Button>
                <Button size="sm" onClick={() => onEdit(client)}>
                  <Pencil size={16} /> Modifier
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{label} :</dt>
      <dd className="min-w-0 truncate font-medium">{value ?? "—"}</dd>
    </div>
  );
}
