"use client";

// Moteur de synchronisation — rejoue la file `syncQueue` vers l'API dès que la connexion revient.
// Règle de résolution de conflit par défaut : « dernier écrit gagne » côté serveur (le serveur fait
// foi), avec journalisation systématique dans SyncLog (statut OK/ECHEC/EN_ATTENTE) pour permettre
// une revue manuelle — voir §11 Amélioration "Synchronisation" (règles configurables en Phase 5).

import { offlineDb, type SyncQueueEntry } from "./db";

const ENDPOINTS: Record<SyncQueueEntry["entite"], string> = {
  sale: "/api/vendre/sync",
  expense: "/api/depenses/sync",
  stock_movement: "/api/stock/sync",
  cash_count: "/api/dashboard/cash-count/sync",
  client: "/api/creances/sync",
  product: "/api/stock/products/sync",
};

let syncing = false;

export async function runSync(): Promise<{ processed: number; failed: number }> {
  if (syncing || typeof navigator === "undefined" || !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }
  syncing = true;
  let processed = 0;
  let failed = 0;

  try {
    const pending = await offlineDb.syncQueue.orderBy("createdAt").toArray();
    for (const entry of pending) {
      const endpoint = ENDPOINTS[entry.entite];
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (entry.id !== undefined) await offlineDb.syncQueue.delete(entry.id);
        processed += 1;
      } catch (err) {
        failed += 1;
        if (entry.id !== undefined) {
          await offlineDb.syncQueue.update(entry.id, {
            attempts: entry.attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } finally {
    syncing = false;
  }

  return { processed, failed };
}

export function startAutoSync() {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => void runSync();
  window.addEventListener("online", onOnline);
  const interval = window.setInterval(() => void runSync(), 30_000);
  void runSync();
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(interval);
  };
}
