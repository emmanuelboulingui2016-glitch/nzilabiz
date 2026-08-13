// POST /api/stock/ajustement — ajustement manuel de stock avec motif obligatoire (§8 🔧).
// N'insère PAS de dépense (simple correction de quantité, pas un achat).

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { products, stockMovements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { MOTIF_AJUSTEMENT_OPTIONS, toNumber } from "@/components/stock/stock-utils";

const MOTIF_VALUES = MOTIF_AJUSTEMENT_OPTIONS.map((m) => m.value) as [string, ...string[]];

const ajustementSchema = z.object({
  productId: z.string().min(1),
  quantite: z.coerce.number().refine((v) => v !== 0, "La quantité d'ajustement ne peut pas être nulle"),
  motifType: z.enum(MOTIF_VALUES as [string, ...string[]]),
  motifDetail: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "stock.ajustement")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ajustementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, data.productId), eq(products.storeId, session.storeId)),
  });
  if (!product) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const nouvelleQuantite = toNumber(product.quantiteStock) + data.quantite;
  if (nouvelleQuantite < 0) {
    return NextResponse.json({ error: "Cet ajustement rendrait le stock négatif." }, { status: 400 });
  }

  const motifLabel = MOTIF_AJUSTEMENT_OPTIONS.find((m) => m.value === data.motifType)?.label ?? data.motifType;
  const motif = data.motifDetail?.trim() ? `${motifLabel} — ${data.motifDetail.trim()}` : motifLabel;

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(products)
      .set({
        quantiteStock: sql`${products.quantiteStock} + ${data.quantite}::numeric`,
        misAJourLe: new Date(),
      })
      .where(eq(products.id, data.productId))
      .returning();

    const [movement] = await tx
      .insert(stockMovements)
      .values({
        productId: data.productId,
        type: "AJUSTEMENT",
        quantite: String(data.quantite),
        motif,
        userId: session.userId,
      })
      .returning();

    return { product: updated, movement };
  });

  return NextResponse.json(result, { status: 201 });
}
