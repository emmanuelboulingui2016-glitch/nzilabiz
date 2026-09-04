"use client";

// Couche offline-first (IndexedDB via Dexie.js) — §2 "Stockage local / offline-first" et
// §11 "Synchronisation" du cahier des charges.
//
// Principe : chaque écran qui doit fonctionner hors-ligne (Vendre, Stock, Dépenses...) écrit
// D'ABORD dans ces tables locales (source de vérité pendant l'usage hors-ligne), puis pousse une
// entrée dans `syncQueue`. Le moteur de synchronisation (sync-engine.ts) rejoue la file dès que la
// connexion revient, avec attribution utilisateur/appareil sur chaque mutation (amélioration §2).

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
  /**
   * Boutique à laquelle appartient la mutation — indispensable sur un appareil que plusieurs
   * vendeurs se partagent. Sans elle, une vente encaissée hors connexion par la boutique A pouvait
   * être rejouée sous la session de la boutique B après un changement de compte sur le même
   * téléphone : `runSync` ne filtrait rien, et l'API attribuait la vente à la session active au
   * moment du rejeu — l'argent de A partait dans les comptes de B, silencieusement.
   *
   * `null` uniquement pour les entrées héritées de la version 1 du schéma (avant ce champ),
   * migrées en version 2 sans avoir pu être rattachées à une boutique — voir l'`upgrade()`
   * ci-dessous et `appartientALaBoutique`.
   */
  storeId: string | null;
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

    // v2 : ajoute `storeId` à `syncQueue`, pour que le moteur de synchro puisse refuser de rejouer
    // sous la mauvaise boutique une entrée créée par une autre, sur un appareil partagé.
    //
    // Des commerçants ont déjà, sur leur téléphone, des entrées v1 sans ce champ — potentiellement
    // des ventes encaissées hors connexion et jamais encore envoyées au serveur. Les jeter à la
    // migration reviendrait à perdre de l'argent réellement encaissé pour corriger un bug de
    // sécurité : aussi absurde que le bug lui-même. `upgrade()` retrouve donc leur boutique par
    // recoupement avec `sales` — la vente locale correspondante (même id, posée dans `sales` avant
    // sa mise en file, voir vendre-screen.tsx) porte déjà un `storeId` fiable.
    //
    // Une entrée qui reste malgré tout sans correspondance (`sales` déjà nettoyée entre-temps, ou
    // entité future autre que "sale") est laissée à `storeId: null` plutôt que supprimée : voir
    // `appartientALaBoutique` pour ce que ça implique au rejeu.
    this.version(2)
      .stores({
        products: "id, storeId, reference, codeBarres",
        sales: "id, storeId, numero, synced, dateHeure",
        syncQueue: "++id, entite, entiteId, createdAt, storeId",
      })
      .upgrade(async (tx) => {
        const ventes = await tx.table<OfflineSale, string>("sales").toArray();
        const storeIdParVenteId = new Map(ventes.map((v) => [v.id, v.storeId]));
        await tx
          .table<SyncQueueEntry, number>("syncQueue")
          .toCollection()
          .modify((entry) => {
            if (entry.storeId === undefined) {
              entry.storeId = storeIdParVenteId.get(entry.entiteId) ?? null;
            }
          });
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

/**
 * Clé locale stable (`dev_xxx`, générée dans ce navigateur et persistée en `localStorage`) —
 * **PAS un identifiant d'appareil serveur**. `devices.id` est une clé générée par la base au moment
 * de la connexion (§2, §11) ; cette valeur-ci ne provient d'aucune insertion dans `devices` et ne
 * peut donc jamais correspondre à une ligne réelle de cette table (contrainte de clé étrangère
 * `sales.device_id → devices.id`).
 *
 * Historiquement confondue avec un vrai `devices.id` : envoyée telle quelle dans
 * `payload.deviceId` du corps de synchro (`vendre-screen.tsx`), elle ne pouvait jamais satisfaire
 * la contrainte de clé étrangère au moment de créer la vente côté serveur — une vente hors ligne
 * remontée échouait silencieusement et restait en file indéfiniment. `/api/vendre/sync` retombe
 * désormais sur l'appareil de la session quand `payload.deviceId` ne correspond à aucun appareil
 * réel de la boutique, ce qui absorbe le problème ; mais côté client, ne plus envoyer cette valeur
 * comme si elle désignait un appareil reste la bonne hygiène — voir son seul point d'usage dans
 * `enqueueMutation` (vendre-screen.tsx).
 *
 * Son unique rôle légitime restant : servir de repère purement local (ex. `OfflineSale.deviceId`
 * dans les tables Dexie de ce navigateur), jamais une valeur à faire vérifier par le serveur.
 */
export function getOrCreateDeviceId(): string {
  const KEY = "nzilabiz.device_id";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Décide si une entrée de `syncQueue` doit être traitée (affichée, comptée, envoyée) par la
 * session de `storeId`.
 *
 * `entry.storeId === storeId` est le cas normal. `entry.storeId === null` est le cas hérité d'une
 * base migrée depuis la version 1 (voir l'`upgrade()` du constructeur), pour une entrée qu'on n'a
 * pas pu rattacher à une boutique précise : on choisit de la laisser passer sous la première
 * session qui la rencontre plutôt que de la bloquer indéfiniment. Une entrée sans `storeId` que
 * plus personne ne réclame jamais ne serait pas plus « en sécurité » — ce serait juste de l'argent
 * encaissé, perdu en silence, comme avant ce correctif. Le risque résiduel (rattachement à la
 * mauvaise boutique) est strictement le même qu'avant, pour ce seul cas hérité et non résolu ; il
 * ne concerne aucune nouvelle entrée, qui porte désormais toujours un `storeId` réel.
 */
export function appartientALaBoutique(entry: Pick<SyncQueueEntry, "storeId">, storeId: string): boolean {
  return entry.storeId === null || entry.storeId === storeId;
}

/**
 * Nombre d'entrées encore en attente d'envoi au serveur pour une boutique donnée — ventes
 * encaissées hors connexion en tête. Simple lecture, sans effet de bord : sert à décider, avant de
 * purger quoi que ce soit ou de déconnecter qui que ce soit, s'il faut prévenir l'utilisateur.
 *
 * Sans `storeId` (appelant qui ne le connaît pas encore — voir lib/auth/deconnexion.ts), compte
 * toutes les entrées de l'appareil, tous comptes confondus : moins précis, mais jamais en dessous
 * de la réalité, ce qui est le sens correct de l'erreur ici — prévenir à tort ne coûte qu'un clic
 * de confirmation, ne pas prévenir peut coûter une vente.
 */
export async function compterVentesEnAttente(storeId?: string): Promise<number> {
  if (!storeId) return offlineDb.syncQueue.count();
  const toutes = await offlineDb.syncQueue.toArray();
  return toutes.filter((entry) => appartientALaBoutique(entry, storeId)).length;
}

/**
 * Purge les données métier locales, typiquement à la déconnexion — un appareil de boutique se
 * partage souvent entre vendeurs, et rien ne doit rester lisible par le suivant.
 *
 * `products` n'est qu'une copie de lecture du catalogue (prix d'achat compris, donc la marge) :
 * reconstructible à tout moment depuis le serveur, elle est toujours vidée, sans condition.
 *
 * `syncQueue` est d'une autre nature : elle contient les ventes encaissées hors connexion et pas
 * encore remontées au serveur — la seule copie qui en existe. La vider aveuglément détruirait de
 * l'argent réellement encaissé par le commerçant. Elle n'est donc purgée, avec `sales` qui n'en
 * est alors plus qu'un miroir, que si elle est déjà vide au moment de l'appel : dans ce cas rien
 * n'est en attente et `sales` ne contient que des ventes que le serveur a déjà reçues.
 *
 * @returns le nombre d'entrées laissées dans `syncQueue` — `0` si tout a pu être purgé, une valeur
 * positive si des ventes en attente ont empêché la purge de `syncQueue` et `sales`. L'appelant
 * doit alors prévenir l'utilisateur avant de le déconnecter, pas après coup.
 */
export async function purgerDonneesLocales(): Promise<number> {
  await offlineDb.products.clear();

  const enAttente = await offlineDb.syncQueue.count();
  if (enAttente > 0) return enAttente;

  await offlineDb.sales.clear();
  await offlineDb.syncQueue.clear();
  return 0;
}
