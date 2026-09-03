"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Smartphone, ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// "Sessions actives" — §14 . Ne réimplémente PAS le stockage des appareils : consomme
// `GET /api/synchronisation/devices` (construit par l'agent Synchronisation) et
// `POST /api/synchronisation/devices/[id]/revoke`. Défensif : si l'endpoint n'existe pas encore
// (404) ou si l'accès est refusé (403), affiche un état informatif plutôt que de planter.

type DeviceEntry = {
  id: string;
  nom: string;
  userAgent: string | null;
  derniereActivite: string;
  creeLe: string;
  revoque: boolean;
  userId: string;
  userNom: string | null;
};

type LoadState = "loading" | "ready" | "unavailable" | "denied";

export function ActiveSessions({
  currentUserId,
  currentDeviceId,
}: {
  currentUserId: string;
  currentDeviceId: string | null;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/synchronisation/devices");
        if (cancelled) return;
        if (res.status === 404) {
          setState("unavailable");
          return;
        }
        if (res.status === 403 || res.status === 401) {
          setState("denied");
          return;
        }
        if (!res.ok) {
          setState("unavailable");
          return;
        }
        const data = await res.json().catch(() => ({ devices: [] }));
        const list: DeviceEntry[] = Array.isArray(data.devices) ? data.devices : [];
        setDevices(list.filter((d) => d.userId === currentUserId));
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const revoke = async (device: DeviceEntry) => {
    if (device.id === currentDeviceId) {
      toast.error("Vous ne pouvez pas déconnecter l'appareil que vous utilisez actuellement.");
      return;
    }
    if (!window.confirm(`Déconnecter « ${device.nom} » ?`)) return;
    setRevokingId(device.id);
    try {
      const res = await fetch(`/api/synchronisation/devices/${device.id}/revoke`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de déconnecter cet appareil.");
        return;
      }
      setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, revoque: true } : d)));
      toast.success(`« ${device.nom} » déconnecté.`);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions actives</CardTitle>
        <p className="text-xs text-muted-foreground">
          Appareils sur lesquels votre compte est connecté. Déconnectez-en un s&apos;il est perdu ou volé.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {state === "loading" && <p className="py-4 text-sm text-muted-foreground">Chargement...</p>}
        {state === "unavailable" && (
          <p className="py-4 text-sm text-muted-foreground">
            La liste des appareils n&apos;est pas disponible pour le moment (module Synchronisation non prêt).
            Réessayez plus tard, ou consultez l&apos;onglet Synchronisation.
          </p>
        )}
        {state === "denied" && (
          <p className="py-4 text-sm text-muted-foreground">Vous n&apos;avez pas accès à cette information.</p>
        )}
        {state === "ready" && devices.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">Aucun appareil enregistré pour votre compte.</p>
        )}
        {state === "ready" &&
          devices.map((device) => {
            const isCurrent = device.id === currentDeviceId;
            return (
              <div
                key={device.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-muted-foreground">
                    <Smartphone size={18} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{device.nom}</span>
                      {isCurrent && <Badge tone="info">Cet appareil</Badge>}
                      {device.revoque && <Badge tone="danger">Déconnecté</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dernière activité{" "}
                      {formatDistanceToNow(new Date(device.derniereActivite), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 sm:pl-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={device.revoque || isCurrent || revokingId === device.id}
                    onClick={() => revoke(device)}
                    title={isCurrent ? "Vous ne pouvez pas déconnecter l'appareil que vous utilisez actuellement." : undefined}
                  >
                    <ShieldOff size={14} />
                    {device.revoque ? "Déconnecté" : "Déconnecter"}
                  </Button>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
