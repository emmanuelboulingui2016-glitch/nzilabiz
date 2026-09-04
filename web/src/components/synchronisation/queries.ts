// Helpers de lecture serveur pour le module Synchronisation (§11 du cahier des charges).
// Utilisés à la fois par les Server Components (rendu initial) et par les routes API
// (rafraîchissement côté client après un `runSync()`).

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { devices, syncLogs, users } from "@/db/schema";

export type SyncLogEntry = {
  id: string;
  entite: string;
  entiteId: string | null;
  action: string;
  statut: "OK" | "ECHEC" | "EN_ATTENTE";
  message: string | null;
  horodatage: string;
  userNom: string | null;
  deviceNom: string | null;
};

export type SyncStatus = {
  /**
   * Boutique de la session qui a demandé ce statut — simple écho du paramètre reçu, sans requête
   * supplémentaire. Sert côté client (`sync-dashboard.tsx`) à filtrer `syncQueue` (IndexedDB) par
   * boutique avant un `runSync()` manuel, sur un appareil que plusieurs vendeurs peuvent partager.
   */
  storeId: string;
  lastSyncAt: string | null;
  echecsCount: number;
  echecs: SyncLogEntry[];
  journal: SyncLogEntry[];
};

export type DeviceEntry = {
  id: string;
  nom: string;
  userAgent: string | null;
  derniereActivite: string;
  creeLe: string;
  revoque: boolean;
  userId: string;
  userNom: string | null;
};

/** Résumé de synchronisation pour une boutique : dernière sync OK, échecs, journal. */
export async function getSyncStatus(storeId: string): Promise<SyncStatus> {
  const rows = await db
    .select({
      id: syncLogs.id,
      entite: syncLogs.entite,
      entiteId: syncLogs.entiteId,
      action: syncLogs.action,
      statut: syncLogs.statut,
      message: syncLogs.message,
      horodatage: syncLogs.horodatage,
      userNom: users.nom,
      deviceNom: devices.nom,
    })
    .from(syncLogs)
    .leftJoin(users, eq(syncLogs.userId, users.id))
    .leftJoin(devices, eq(syncLogs.deviceId, devices.id))
    .where(eq(syncLogs.storeId, storeId))
    .orderBy(desc(syncLogs.horodatage))
    .limit(150);

  const serialized: SyncLogEntry[] = rows.map((r) => ({
    id: r.id,
    entite: r.entite,
    entiteId: r.entiteId,
    action: r.action,
    statut: r.statut,
    message: r.message,
    horodatage: r.horodatage.toISOString(),
    userNom: r.userNom,
    deviceNom: r.deviceNom,
  }));

  const lastOk = serialized.find((r) => r.statut === "OK");
  const echecsAll = serialized.filter((r) => r.statut === "ECHEC");

  return {
    storeId,
    lastSyncAt: lastOk?.horodatage ?? null,
    echecsCount: echecsAll.length,
    echecs: echecsAll.slice(0, 30),
    journal: serialized.slice(0, 30),
  };
}

/** Liste des appareils enregistrés pour une boutique, avec le nom de l'utilisateur associé. */
export async function getDevices(storeId: string): Promise<DeviceEntry[]> {
  const rows = await db
    .select({
      id: devices.id,
      nom: devices.nom,
      userAgent: devices.userAgent,
      derniereActivite: devices.derniereActivite,
      creeLe: devices.creeLe,
      revoque: devices.revoque,
      userId: devices.userId,
      userNom: users.nom,
    })
    .from(devices)
    .leftJoin(users, eq(devices.userId, users.id))
    .where(eq(devices.storeId, storeId))
    .orderBy(desc(devices.derniereActivite));

  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    userAgent: r.userAgent,
    derniereActivite: r.derniereActivite.toISOString(),
    creeLe: r.creeLe.toISOString(),
    revoque: r.revoque,
    userId: r.userId,
    userNom: r.userNom,
  }));
}

/** Récupère un appareil par id, filtré par boutique (multi-tenant strict). */
export async function getDeviceForStore(storeId: string, deviceId: string) {
  return db.query.devices.findFirst({
    where: and(eq(devices.id, deviceId), eq(devices.storeId, storeId)),
  });
}
