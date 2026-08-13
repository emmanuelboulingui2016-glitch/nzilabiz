"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Smartphone, ShieldOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DeviceEntry } from "./queries";

export function DeviceManager({
  initialDevices,
  currentDeviceId,
}: {
  initialDevices: DeviceEntry[];
  currentDeviceId: string | null;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revoke = async (device: DeviceEntry) => {
    if (device.id === currentDeviceId) {
      toast.error("Vous ne pouvez pas révoquer l'appareil que vous utilisez actuellement.");
      return;
    }
    if (!window.confirm(`Révoquer l'accès de « ${device.nom} » ? Cet appareil ne pourra plus se synchroniser.`)) {
      return;
    }
    setRevokingId(device.id);
    try {
      const res = await fetch(`/api/synchronisation/devices/${device.id}/revoke`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de révoquer cet appareil.");
        return;
      }
      setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, revoque: true } : d)));
      toast.success(`Accès révoqué pour « ${device.nom} ».`);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appareils connectés à la boutique</CardTitle>
        <p className="text-xs text-muted-foreground">
          Un appareil perdu, volé, ou appartenant à un ancien employé ? Révoquez son accès ici — il ne
          pourra plus envoyer ni recevoir de données pour cette boutique.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {devices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun appareil enregistré pour le moment.</p>
        ) : (
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
                      {device.revoque && <Badge tone="danger">Révoqué</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {device.userNom ? `Utilisé par ${device.userNom}` : "Utilisateur inconnu"} · Dernière activité{" "}
                      {formatDistanceToNow(new Date(device.derniereActivite), { addSuffix: true, locale: fr })}
                    </p>
                    {device.userAgent && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{device.userAgent}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 sm:pl-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={device.revoque || isCurrent || revokingId === device.id}
                    onClick={() => revoke(device)}
                    title={isCurrent ? "Vous ne pouvez pas révoquer l'appareil que vous utilisez actuellement." : undefined}
                  >
                    <ShieldOff size={14} />
                    {device.revoque ? "Révoqué" : "Révoquer"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
