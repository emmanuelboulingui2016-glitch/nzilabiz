// Logique de création de vente partagée entre POST /api/vendre (chemin en ligne, autoritaire)
// et POST /api/vendre/sync (rejoue une mutation de vente mise en file hors-ligne). §6 + §11.
//
// Idempotence : si `id` est fourni (id généré côté client / Dexie) et qu'une vente avec cet id
// existe déjà, on la retourne telle quelle sans rien recréer — permet au moteur de synchro de
// rejouer sans risque de doublon (retry-safe).

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { payments, products, saleItems, sales, stockMovements } from "@/db/schema";
import { genSaleNumber } from "@/lib/utils";

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
    const existing = await db.query.sales.findFirst({
      where: eq(sales.id, input.id),
      with: { items: true, payments: true },
    });
    if (existing) {
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
    const resolvedItems = input.items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new CreateSaleError(`Produit introuvable ou n'appartenant pas à cette boutique : ${item.productId}`);
      }
      if (item.quantite <= 0) {
        throw new CreateSaleError("La quantité doit être supérieure à zéro.");
      }
      const prixUnitaire = item.prixUnitaire ?? Number(product.prixVente);
      const prixAchatUnitaire = item.prixAchatUnitaire ?? Number(product.prixAchat);
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
