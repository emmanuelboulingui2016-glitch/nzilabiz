// POST /api/stock/receptions — « Réceptionner une livraison » (§8 🔧 amélioration principale).
//
// Unifie en une seule transaction ce qui était deux actions manuelles déconnectées dans l'app
// d'origine : (1) la dépense « Rachats de stock » et (2) la mise à jour des quantités en stock.
// Crée : 1 StockReceipt, N StockReceiptItem, N StockMovement (RECEPTION), et 1 Expense — tout ou
// rien via db.transaction().

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { expenses, products, stockMovements, stockReceiptItems, stockReceipts } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";

const ligneSchema = z.object({
  productId: z.string().min(1),
  quantite: z.coerce.number().positive("La quantité doit être positive"),
  prixAchat: z.coerce.number().min(0, "Le prix d'achat doit être positif ou nul"),
});

const receptionSchema = z.object({
  fournisseur: z.string().min(1, "Le fournisseur est requis"),
  modeReglement: z.enum(["ESPECES", "MOBILE_MONEY", "CREDIT"]).default("ESPECES"),
  lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne de réception"),
  montantTotal: z.coerce.number().min(0).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = receptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  // Vérifie que tous les produits appartiennent bien à la boutique de l'utilisateur.
  const productIds = [...new Set(data.lignes.map((l) => l.productId))];
  const ownedProducts = await db.query.products.findMany({
    where: eq(products.storeId, session.storeId),
  });
  const ownedIds = new Set(ownedProducts.filter((p) => productIds.includes(p.id)).map((p) => p.id));
  const missing = productIds.filter((id) => !ownedIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ error: "Un ou plusieurs produits sélectionnés sont introuvables." }, { status: 400 });
  }

  const computedTotal = data.lignes.reduce((sum, l) => sum + l.quantite * l.prixAchat, 0);
  const montantTotal = data.montantTotal !== undefined && data.montantTotal > 0 ? data.montantTotal : computedTotal;

  const result = await db.transaction(async (tx) => {
    const [receipt] = await tx
      .insert(stockReceipts)
      .values({
        storeId: session.storeId,
        fournisseur: data.fournisseur,
        montantTotal: String(montantTotal),
        userId: session.userId,
      })
      .returning();

    for (const ligne of data.lignes) {
      await tx.insert(stockReceiptItems).values({
        stockReceiptId: receipt.id,
        productId: ligne.productId,
        quantite: String(ligne.quantite),
        prixAchat: String(ligne.prixAchat),
      });

      // Incrémente le stock et met à jour le prix d'achat courant (dernier coût connu).
      await tx
        .update(products)
        .set({
          quantiteStock: sql`${products.quantiteStock} + ${ligne.quantite}::numeric`,
          prixAchat: String(ligne.prixAchat),
          misAJourLe: new Date(),
        })
        .where(eq(products.id, ligne.productId));

      await tx.insert(stockMovements).values({
        productId: ligne.productId,
        type: "RECEPTION",
        quantite: String(ligne.quantite),
        motif: `Réception livraison — ${data.fournisseur}`,
        userId: session.userId,
        stockReceiptId: receipt.id,
      });
    }

    const [expense] = await tx
      .insert(expenses)
      .values({
        storeId: session.storeId,
        userId: session.userId,
        categorie: "Rachats de stock",
        description: `Réception livraison — ${data.fournisseur}`,
        montant: String(montantTotal),
        modeReglement: data.modeReglement,
        recurrente: false,
        stockReceiptId: receipt.id,
      })
      .returning();

    return { receipt, expense };
  });

  return NextResponse.json({ receipt: result.receipt, expense: result.expense }, { status: 201 });
}
