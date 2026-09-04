// Logique de création de vente partagée entre POST /api/vendre (chemin en ligne, autoritaire)
// et POST /api/vendre/sync (rejoue une mutation de vente mise en file hors-ligne). §6 + §11.
//
// Idempotence : si `id` est fourni (id généré côté client / Dexie) et qu'une vente avec cet id
// existe déjà, on la retourne telle quelle sans rien recréer — permet au moteur de synchro de
// rejouer sans risque de doublon (retry-safe).

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { payments, products, saleItems, sales, stockMovements, syncLogs } from "@/db/schema";
import { genSaleNumber } from "@/lib/utils";

/**
 * Écart maximal toléré entre le prix unitaire déclaré par le client (chemin hors-ligne) et le
 * prix catalogue courant du produit, en proportion du prix catalogue.
 *
 * Une vente hors-ligne rejouée plusieurs jours plus tard doit garder le prix réellement payé par
 * le client au moment de la vente (voir `CreateSaleInput.dateHeure`) : si le patron a changé ses
 * tarifs entre-temps, écraser avec le prix courant fausserait la comptabilité et le reçu déjà
 * remis. On accepte donc le prix client, mais borné : au-delà de ce seuil, ce n'est plus l'effet
 * d'une hausse ou d'une baisse tarifaire légitime, c'est un prix librement dicté par le client —
 * exactement ce qui permet à un vendeur de sous-déclarer une vente pour empocher la différence.
 * Les rabais négociés au comptoir ont déjà leur propre canal (`remise` / `typeRemise`, appliqué
 * au niveau de la vente entière) : un prix unitaire qui s'écarte fortement du catalogue n'a donc
 * aucune justification légitime restante.
 */
const PRICE_DEVIATION_RATIO_MAX = 0.2; // 20 %

export class CreateSaleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type CreateSaleItemInput = {
  productId: string;
  quantite: number;
  /** Prix figé au moment de la vente. Si omis (chemin en ligne), résolu depuis le produit courant. */
  prixUnitaire?: number;
  /** Prix d'achat figé au moment de la vente. Si omis, résolu depuis le produit courant. */
  prixAchatUnitaire?: number;
};

export type CreateSalePaymentInput = {
  mode: "ESPECES" | "MOBILE_MONEY" | "CREDIT";
  montant: number;
  montantRecu?: number | null;
  monnaieRendue?: number | null;
  reference?: string | null;
};

export type CreateSaleInput = {
  id?: string;
  storeId: string;
  userId: string;
  deviceId?: string | null;
  clientId?: string | null;
  /** Horodatage réel de la vente (permet de préserver l'heure d'une vente hors-ligne rejouée plus tard). */
  dateHeure?: Date;
  items: CreateSaleItemInput[];
  remise: number;
  typeRemise: "MONTANT" | "POURCENTAGE";
  payments: CreateSalePaymentInput[];
};

export async function createSale(input: CreateSaleInput) {
  if (input.id) {
    // L'id est généré côté navigateur (Dexie), donc rien ne garantit qu'il appartient à la
    // boutique de l'appelant : sans le vérifier, rejouer l'id d'une vente vue ailleurs (numéro,
    // panier, prix d'achat donc marge) suffirait à se la faire retourner intégralement. On charge
    // la vente sans filtrer par storeId — pour distinguer idempotence légitime et collision — mais
    // on ne la renvoie que si elle appartient bien à l'appelant.
    const existing = await db.query.sales.findFirst({
      where: eq(sales.id, input.id),
      with: { items: true, payments: true },
    });
    if (existing) {
      if (existing.storeId !== input.storeId) {
        // Collision d'id entre boutiques : l'id étant généré côté client avec un espace aléatoire
        // énorme, ce cas ne devrait jamais se produire pour un appareil légitime. On le rejette
        // explicitement plutôt que de laisser l'INSERT plus bas échouer sur une violation de clé
        // primaire Postgres — l'appelant reçoit un message clair au lieu d'une erreur de contrainte
        // brute, et aucune donnée de l'autre boutique n'est renvoyée.
        throw new CreateSaleError("Cet identifiant de vente est déjà utilisé.", 409);
      }
      return { sale: existing, alreadyExisted: true as const };
    }
  }

  if (!input.items.length) {
    throw new CreateSaleError("Le panier est vide.");
  }
  if (!input.payments.length) {
    throw new CreateSaleError("Au moins un mode de paiement est requis.");
  }
  const hasCredit = input.payments.some((p) => p.mode === "CREDIT");
  if (hasCredit && !input.clientId) {
    throw new CreateSaleError("Un client est requis pour un paiement à crédit.");
  }

  const sale = await db.transaction(async (tx) => {
    // Sérialise la numérotation des ventes par boutique (évite les doublons de numéro sous concurrence).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.storeId}))`);

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const rows = await tx
      .select()
      .from(products)
      .where(and(eq(products.storeId, input.storeId), inArray(products.id, productIds)))
      .for("update");
    const byId = new Map(rows.map((r) => [r.id, r]));

    let sousTotal = 0;
    // Lignes dont le prix client diverge (dans la tolérance) du catalogue courant — journalisées
    // après coup dans `syncLogs` pour que le patron puisse les repasser en revue (§ audit sécurité
    // sur /api/vendre/sync : un prix client jamais vérifié permettait une sous-déclaration propre).
    const divergences: { nom: string; catalogue: number; declare: number }[] = [];
    const resolvedItems = input.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new CreateSaleError(`Produit introuvable ou n'appartenant pas à cette boutique : ${item.productId}`);
      }
      if (item.quantite <= 0) {
        throw new CreateSaleError("La quantité doit être supérieure à zéro.");
      }

      const catalogPrixVente = Number(product.prixVente);
      let prixUnitaire = catalogPrixVente;
      if (item.prixUnitaire !== undefined) {
        // Chemin hors-ligne : prix figé au moment réel de la vente, envoyé par le client. Accepté,
        // mais borné par rapport au catalogue courant — voir PRICE_DEVIATION_RATIO_MAX ci-dessus.
        // catalogPrixVente === 0 : pas de référence exploitable pour borner (produit à prix nul,
        // cas marginal) — on accepte tel quel plutôt que de bloquer une synchro légitime.
        if (catalogPrixVente > 0) {
          const ecart = Math.abs(item.prixUnitaire - catalogPrixVente) / catalogPrixVente;
          if (ecart > PRICE_DEVIATION_RATIO_MAX) {
            throw new CreateSaleError(
              `Le prix de vente déclaré pour "${product.nom}" (${item.prixUnitaire} FCFA) s'écarte de plus de ${Math.round(
                PRICE_DEVIATION_RATIO_MAX * 100
              )} % du prix catalogue (${catalogPrixVente} FCFA). Synchronisation refusée — contactez le gérant si le prix a réellement changé.`
            );
          }
          if (item.prixUnitaire !== catalogPrixVente) {
            divergences.push({ nom: product.nom, catalogue: catalogPrixVente, declare: item.prixUnitaire });
          }
        }
        prixUnitaire = item.prixUnitaire;
      }

      // Prix d'achat : donnée interne de la boutique, jamais négociée au comptoir — toujours
      // résolue depuis le catalogue serveur, quoi qu'envoie le client (jamais `item.prixAchatUnitaire`).
      // Défaut assumé : si le prix d'achat a changé entre la vente hors-ligne et la synchro, la
      // marge historique de cette ligne sera légèrement inexacte — bien moindre que le risque
      // inverse, laisser le client dicter sa propre marge affichée au patron.
      const prixAchatUnitaire = Number(product.prixAchat);

      const ligneSousTotal = Math.round(prixUnitaire * item.quantite);
      sousTotal += ligneSousTotal;
      return { productId: item.productId, quantite: item.quantite, prixUnitaire, prixAchatUnitaire, sousTotal: ligneSousTotal };
    });

    const remiseAmount =
      input.typeRemise === "POURCENTAGE"
        ? Math.round((sousTotal * input.remise) / 100)
        : Math.round(input.remise);
    const total = Math.max(0, sousTotal - remiseAmount);

    const paymentsSum = Math.round(input.payments.reduce((s, p) => s + p.montant, 0));
    if (paymentsSum !== total) {
      throw new CreateSaleError(
        `Le total des paiements (${paymentsSum} FCFA) ne correspond pas au total de la vente (${total} FCFA).`
      );
    }

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(eq(sales.storeId, input.storeId));
    const numero = genSaleNumber((count ?? 0) + 1);

    const [insertedSale] = await tx
      .insert(sales)
      .values({
        ...(input.id ? { id: input.id } : {}),
        storeId: input.storeId,
        numero,
        dateHeure: input.dateHeure ?? new Date(),
        userId: input.userId,
        deviceId: input.deviceId ?? null,
        clientId: input.clientId ?? null,
        sousTotal: String(sousTotal),
        remise: String(remiseAmount),
        typeRemise: input.typeRemise,
        total: String(total),
      })
      .returning();

    if (divergences.length > 0) {
      // Vente acceptée (écart dans la tolérance) mais journalisée : le patron la retrouve dans le
      // module Synchronisation (`getSyncStatus`, statut "OK" avec message) au lieu de découvrir
      // l'écart en recomptant sa marge un mois plus tard.
      const message = divergences
        .map((d) => `${d.nom} : déclaré ${d.declare} FCFA vs catalogue ${d.catalogue} FCFA`)
        .join(" ; ");
      await tx.insert(syncLogs).values({
        storeId: input.storeId,
        userId: input.userId,
        deviceId: input.deviceId ?? null,
        entite: "sale",
        entiteId: insertedSale.id,
        action: "create",
        statut: "OK",
        message: `Prix de vente divergent du catalogue (dans la tolérance de ${Math.round(
          PRICE_DEVIATION_RATIO_MAX * 100
        )} %) : ${message}`,
      });
    }

    const insertedItems = await tx
      .insert(saleItems)
      .values(
        resolvedItems.map((i) => ({
          saleId: insertedSale.id,
          productId: i.productId,
          quantite: String(i.quantite),
          prixUnitaire: String(i.prixUnitaire),
          prixAchatUnitaire: String(i.prixAchatUnitaire),
          sousTotal: String(i.sousTotal),
        }))
      )
      .returning();

    const insertedPayments = await tx
      .insert(payments)
      .values(
        input.payments.map((p) => ({
          saleId: insertedSale.id,
          mode: p.mode,
          montant: String(p.montant),
          montantRecu: p.montantRecu != null ? String(p.montantRecu) : null,
          monnaieRendue: p.monnaieRendue != null ? String(p.monnaieRendue) : null,
          reference: p.reference ?? null,
        }))
      )
      .returning();

    for (const item of resolvedItems) {
      await tx
        .update(products)
        .set({
          quantiteStock: sql`${products.quantiteStock} - ${item.quantite}`,
          misAJourLe: new Date(),
        })
        .where(eq(products.id, item.productId));

      await tx.insert(stockMovements).values({
        productId: item.productId,
        type: "VENTE",
        quantite: String(-item.quantite),
        motif: null,
        userId: input.userId,
        saleId: insertedSale.id,
      });
    }

    return { ...insertedSale, items: insertedItems, payments: insertedPayments };
  });

  return { sale, alreadyExisted: false as const };
}
