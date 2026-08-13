"use client";

// Couche offline-first (IndexedDB via Dexie.js) — §2 "Stockage local / offline-first" et
// §11 "Synchronisation" du cahier des charges.
//
// Principe : chaque écran qui doit fonctionner hors-ligne (Vendre, Stock, Dépenses...) écrit
// D'ABORD dans ces tables locales (source de vérité pendant l'usage hors-ligne), puis pousse une
// entrée dans `syncQueue`. Le moteur de synchronisation (sync-engine.ts) rejoue la file dès que la
// connexion revient, avec attribution utilisateur/appareil sur chaque mutation (🔧 amélioration §2).

import Dexie, { type EntityTable } from "dexie";

export type OfflineProduct = {
  id: string;
  storeId: string;
  reference: string;
  nom: string;
  categoryId?: string | null;
  codeBarres?: string | null;
  prixAchat: number;
  prixVente: number;
  quantiteStock: number;
  seuilAlerte: number;
  misAJourLe: string;
};

export type OfflineSale = {
  id: string; // id local (cuid généré côté client), devient l'id serveur après sync
  storeId: string;
  numero: string;
  dateHeure: string;
  userId: string;
  deviceId: string;
  clientId?: string | null;
  sousTotal: number;
  remise: number;
  typeRemise: "MONTANT" | "POURCENTAGE";
  total: number;
  statut: "VALIDEE" | "ANNULEE";
  items: { productId: string; quantite: number; prixUnitaire: number; sousTotal: number }[];
  payments: { mode: "ESPECES" | "MOBILE_MONEY" | "CREDIT"; montant: number; montantRecu?: number; monnaieRendue?: number }[];
  synced: boolean;
};

export type SyncQueueEntry = {
  id?: number;
  entite: "sale" | "expense" | "stock_movement" | "cash_count" | "client" | "product";
  entiteId: string;
  action: "create" | "update" | "delete";
  payload: unknown;
  userId: string;
  deviceId: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

class NzilaBizOfflineDB extends Dexie {
  products!: EntityTable<OfflineProduct, "id">;
  sales!: EntityTable<OfflineSale, "id">;
  syncQueue!: EntityTable<SyncQueueEntry, "id">;

  constructor() {
    super("nzilabiz-offline");
    this.version(1).stores({
      products: "id, storeId, reference, codeBarres",
      sales: "id, storeId, numero, synced, dateHeure",
      syncQueue: "++id, entite, entiteId, createdAt",
    });
  }
}

export const offlineDb = new NzilaBizOfflineDB();

export async function enqueueMutation(entry: Omit<SyncQueueEntry, "id" | "attempts" | "createdAt">) {
  return offlineDb.syncQueue.add({
    ...entry,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
}

/** Identifiant d'appareil stable, persisté en local — utilisé pour l'attribution device_id (§2, §11). */
export function getOrCreateDeviceId(): string {
  const KEY = "nzilabiz.device_id";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
