"use client";

// Moteur de synchronisation — rejoue la file `syncQueue` vers l'API dès que la connexion revient.
// Règle de résolution de conflit par défaut : « dernier écrit gagne » côté serveur (le serveur fait
// foi), avec journalisation systématique dans SyncLog (statut OK/ECHEC/EN_ATTENTE) pour permettre
// une revue manuelle — voir §11 Amélioration "Synchronisation" (règles configurables en Phase 5).

import { appartientALaBoutique, offlineDb, type SyncQueueEntry } from "./db";

const ENDPOINTS: Record<SyncQueueEntry["entite"], string> = {
  sale: "/api/vendre/sync",
  expense: "/api/depenses/sync",
  stock_movement: "/api/stock/sync",
  cash_count: "/api/dashboard/cash-count/sync",
  client: "/api/creances/sync",
  product: "/api/stock/products/sync",
};

let syncing = false;

/**
 * Rejoue la file vers l'API pour la boutique `storeId` — jamais pour une autre.
 *
 * Un appareil de boutique se partage souvent entre vendeurs : sans ce filtre, une vente encaissée
 * hors connexion par la boutique A, encore en file au moment où la boutique B se connecte sur le
 * même téléphone, aurait été rejouée sous la session de B dès le retour du réseau — l'argent de A
 * attribué à B, silencieusement et définitivement (l'API fait foi de la session active au moment
 * du rejeu, pas du contenu de la charge).
 *
 * Les entrées d'une autre boutique ne sont ni envoyées, ni supprimées, ni comptées en échec — ce
 * n'est pas une erreur, ce sont des ventes qui ne sont simplement pas les nôtres. Elles restent en
 * file, intactes, jusqu'à ce que la bonne boutique se reconnecte sur cet appareil et les
 * synchronise elle-même.
 */
export async function runSync(storeId: string): Promise<{ processed: number; failed: number; ignored: number }> {
  if (syncing || typeof navigator === "undefined" || !navigator.onLine) {
    return { processed: 0, failed: 0, ignored: 0 };
  }
  syncing = true;
  let processed = 0;
  let failed = 0;
  let ignored = 0;

  try {
    const pending = await offlineDb.syncQueue.orderBy("createdAt").toArray();
    for (const entry of pending) {
      if (!appartientALaBoutique(entry, storeId)) {
        ignored += 1;
        continue;
      }
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

  return { processed, failed, ignored };
}

/**
 * Démarre la synchronisation automatique (retour réseau + toutes les 30s) pour la boutique
 * `storeId`.
 *
 * `storeId` est optionnel côté signature uniquement parce que son unique appelant actuel
 * (`app-shell.tsx`) est hors du périmètre de cette correction et ne le transmet pas encore — voir
 * le rapport. Sans lui, impossible de filtrer `syncQueue` en toute sécurité : plutôt que de
 * rejouer la file sans distinction de boutique (exactement le trou que ce correctif comble), on
 * renonce à la synchronisation automatique en arrière-plan. La resynchronisation reste possible
 * depuis un écran qui connaît sa boutique, comme Vendre (`runSync(storeId)` y est appelé après
 * chaque vente).
 */
export function startAutoSync(storeId?: string) {
  if (typeof window === "undefined") return () => {};
  if (!storeId) {
    console.warn(
      "[sync] startAutoSync appelé sans storeId : synchronisation automatique désactivée (voir app-shell.tsx)."
    );
    return () => {};
  }
  const onOnline = () => void runSync(storeId);
  window.addEventListener("online", onOnline);
  const interval = window.setInterval(() => void runSync(storeId), 30_000);
  void runSync(storeId);
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(interval);
  };
}
