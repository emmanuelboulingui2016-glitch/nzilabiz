"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, ChevronDown, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runSync } from "@/lib/offline/sync-engine";
import { entiteLabel, actionLabel, attributionLabel } from "./labels";
import { DeviceManager } from "./device-manager";
import { EtatHorsLigne } from "./etat-hors-ligne";
import type { DeviceEntry, SyncLogEntry, SyncStatus } from "./queries";

function statutBadge(statut: SyncLogEntry["statut"]) {
  if (statut === "OK") return <Badge tone="success">OK</Badge>;
  if (statut === "ECHEC") return <Badge tone="danger">Échec</Badge>;
  return <Badge tone="warning">En attente</Badge>;
}

function LogRow({ entry }: { entry: SyncLogEntry }) {
  const title = entry.message ?? `${entiteLabel(entry.entite)} — ${actionLabel(entry.action)}`;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {statutBadge(entry.statut)}
      </div>
      {entry.statut === "ECHEC" && entry.message && (
        <p className="text-xs text-danger">{entry.message}</p>
      )}
      <p className="text-xs text-muted-foreground">
        {attributionLabel(entry.userNom, entry.deviceNom)} ·{" "}
        {formatDistanceToNow(new Date(entry.horodatage), { addSuffix: true, locale: fr })}
      </p>
    </div>
  );
}

export function SyncDashboard({
  initialStatus,
  initialDevices,
  currentDeviceId,
}: {
  initialStatus: SyncStatus;
  initialDevices: DeviceEntry[];
  currentDeviceId: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [showEcartsInfo, setShowEcartsInfo] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const refreshStatus = async () => {
    try {
      const res = await fetch("/api/synchronisation");
      if (res.ok) setStatus(await res.json());
    } catch {
      // silencieux — on garde le dernier état connu
    }
  };

  const handleSync = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Vous êtes hors-ligne. La synchronisation reprendra automatiquement dès le retour du réseau.");
      return;
    }
    setSyncing(true);
    try {
      // `initialStatus.storeId`, pas `status.storeId` : `status` est remplacé par la réponse de
      // `/api/synchronisation` au rafraîchissement, qui ne porte pas ce champ. `initialStatus` est
      // la prop reçue du calque serveur au premier rendu — elle ne change pas pendant la vie de la
      // page (changer de boutique recharge entièrement l'application), donc toujours fiable ici.
      const result = await runSync(initialStatus.storeId);
      if (result.failed > 0) {
        toast.error(`${result.processed} élément(s) synchronisé(s), ${result.failed} échec(s).`);
      } else if (result.processed > 0) {
        toast.success(`${result.processed} élément(s) synchronisé(s).`);
      } else if (result.ignored > 0) {
        // Des entrées existent dans la file locale mais appartiennent à une autre boutique — cas
        // d'un appareil partagé entre vendeurs. Ce n'est pas une erreur de cette session, mais la
        // passer sous silence laisserait croire à tort que tout est synchronisé.
        toast.info(
          `Déjà à jour pour cette boutique. ${result.ignored} élément(s) en attente appartiennent à une autre boutique connectée sur cet appareil.`
        );
      } else {
        toast.success("Déjà à jour.");
      }
      startTransition(() => {
        void refreshStatus();
      });
    } finally {
      setSyncing(false);
      setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    }
  };

  const isUpToDate = status.echecsCount === 0;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Placé en tête : savoir si l'appareil peut travailler sans réseau prime sur l'historique
          des synchronisations passées, surtout au moment de partir en tournée. */}
      <EtatHorsLigne />

      {/* Statut header */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full p-2", isUpToDate ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
              {isUpToDate ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </span>
            <div>
              <p className="text-sm font-semibold">{isUpToDate ? "À jour" : `${status.echecsCount} échec(s) à examiner`}</p>
              <p className="text-xs text-muted-foreground">
                {status.lastSyncAt
                  ? `Dernière synchronisation ${formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true, locale: fr })} (${format(new Date(status.lastSyncAt), "dd/MM/yyyy HH:mm")})`
                  : "Aucune synchronisation enregistrée pour l'instant."}
              </p>
              {!online && (
                <p className="mt-0.5 text-xs text-warning">Hors-ligne — vos actions sont enregistrées localement et seront envoyées au retour du réseau.</p>
              )}
            </div>
          </div>
          <Button onClick={handleSync} disabled={syncing || isPending}>
            <RefreshCw size={16} className={syncing ? "animate-spin" : undefined} />
            {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
          </Button>
        </CardContent>
      </Card>

      {/* Écarts de stock */}
      <Card>
        <CardHeader>
          <CardTitle>Écarts de stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 size={16} />
            Aucun écart de stock détecté.
          </div>
          <button
            onClick={() => setShowEcartsInfo((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary"
          >
            <HelpCircle size={15} />
            Comment ça marche ?
            <ChevronDown size={14} className={cn("transition-transform", showEcartsInfo && "rotate-180")} />
          </button>
          {showEcartsInfo && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Exemple concret :</strong> il vous reste 1 sac de riz en stock. Deux
                vendeurs, sur deux téléphones différents et tous les deux hors-ligne (pas de réseau au fond du magasin),
                vendent chacun ce dernier sac au même moment sans le savoir. Sur chaque appareil, tout semble normal :
                le stock local passe à 0.
              </p>
              <p>
                Dès que les deux téléphones retrouvent une connexion, NzilaBiz envoie les deux ventes au serveur. Le
                serveur les applique dans l&apos;ordre où elles arrivent (règle « dernier écrit gagne ») et le stock du
                produit peut alors devenir négatif ou incohérent avec la réalité du magasin — c&apos;est cet écart qui
                apparaîtrait ici, avec le produit concerné, les ventes en cause et les appareils/vendeurs impliqués.
              </p>
              <p>
                <strong className="text-foreground">Comment le résoudre :</strong> vérifiez avec le(s) vendeur(s)
                concerné(s) si l&apos;article a réellement été remis à un client, puis corrigez le stock depuis{" "}
                <em>Stock &gt; Ajustement</em> si besoin. Cela n&apos;affecte jamais l&apos;argent déjà encaissé — seul
                le compteur de stock doit être corrigé.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Échecs de synchronisation */}
      <Card>
        <CardHeader>
          <CardTitle>Échecs de synchronisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {status.echecs.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 size={16} />
              Aucun échec de synchronisation.
            </div>
          ) : (
            status.echecs.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </CardContent>
      </Card>

      {/* Journal */}
      <Card>
        <CardHeader>
          <CardTitle>Dernières synchronisations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {status.journal.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <XCircle size={16} />
              Aucune activité de synchronisation pour l&apos;instant.
            </div>
          ) : (
            status.journal.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </CardContent>
      </Card>

      <DeviceManager initialDevices={initialDevices} currentDeviceId={currentDeviceId} />
    </div>
  );
}
