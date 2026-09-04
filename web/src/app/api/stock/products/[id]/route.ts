// GET/PUT/DELETE /api/stock/products/[id] — fiche produit + historique des mouvements (§8)

import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, products, stockMovements, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { computeStatut, toNumber, type MovementRow } from "@/components/stock/stock-utils";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { imageEnvoyee } from "@/lib/validation/fichier";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "stock.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.storeId, session.storeId)),
    with: { category: true },
  });
  if (!product) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const movementRows = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantite: stockMovements.quantite,
      motif: stockMovements.motif,
      date: stockMovements.date,
      userId: stockMovements.userId,
      userNom: users.nom,
      saleId: stockMovements.saleId,
      stockReceiptId: stockMovements.stockReceiptId,
    })
    .from(stockMovements)
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .where(eq(stockMovements.productId, id))
    .orderBy(desc(stockMovements.date));

  const movements: MovementRow[] = movementRows.map((m) => ({
    id: m.id,
    type: m.type,
    quantite: m.quantite,
    motif: m.motif,
    date: m.date.toISOString(),
    userId: m.userId,
    userNom: m.userNom,
    saleId: m.saleId,
    stockReceiptId: m.stockReceiptId,
  }));

  return NextResponse.json({
    product: {
      id: product.id,
      reference: product.reference,
      nom: product.nom,
      photoUrl: product.photoUrl,
      categoryId: product.categoryId,
      categoryNom: product.category?.nom ?? null,
      codeBarres: product.codeBarres,
      datePeremption: product.datePeremption ? product.datePeremption.toISOString() : null,
      prixAchat: product.prixAchat,
      prixVente: product.prixVente,
      prixGros: product.prixGros,
      unite: product.unite,
      quantiteStock: product.quantiteStock,
      seuilAlerte: product.seuilAlerte,
      statut: computeStatut(toNumber(product.quantiteStock), toNumber(product.seuilAlerte)),
      creeLe: product.creeLe.toISOString(),
    },
    movements,
  });
}

const updateProductSchema = z.object({
  nom: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  categoryNom: z.string().nullable().optional(),
  codeBarres: z.string().nullable().optional(),
  datePeremption: z.string().nullable().optional(),
  prixAchat: z.coerce.number().min(0).optional(),
  prixVente: z.coerce.number().min(0).optional(),
  prixGros: z.coerce.number().min(0).nullable().optional(),
  unite: z.string().min(1).optional(),
  seuilAlerte: z.coerce.number().min(0).optional(),
  photoUrl: imageEnvoyee.nullable().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.storeId, session.storeId)),
  });
  if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  let categoryId = data.categoryId !== undefined ? data.categoryId : existing.categoryId;
  if (data.categoryNom?.trim()) {
    const nom = data.categoryNom.trim();
    const cat = await db.query.categories.findFirst({
      where: and(eq(categories.storeId, session.storeId), eq(categories.nom, nom)),
    });
    if (cat) {
      categoryId = cat.id;
    } else {
      const [created] = await db.insert(categories).values({ storeId: session.storeId, nom }).returning();
      categoryId = created.id;
    }
  }

  const [updated] = await db
    .update(products)
    .set({
      nom: data.nom ?? existing.nom,
      categoryId,
      codeBarres: data.codeBarres !== undefined ? data.codeBarres : existing.codeBarres,
      datePeremption: data.datePeremption !== undefined ? (data.datePeremption ? new Date(data.datePeremption) : null) : existing.datePeremption,
      prixAchat: data.prixAchat !== undefined ? String(data.prixAchat) : existing.prixAchat,
      prixVente: data.prixVente !== undefined ? String(data.prixVente) : existing.prixVente,
      prixGros: data.prixGros !== undefined ? (data.prixGros != null ? String(data.prixGros) : null) : existing.prixGros,
      unite: data.unite ?? existing.unite,
      seuilAlerte: data.seuilAlerte !== undefined ? String(data.seuilAlerte) : existing.seuilAlerte,
      photoUrl: data.photoUrl !== undefined ? data.photoUrl : existing.photoUrl,
      misAJourLe: new Date(),
    })
    // Le SELECT préalable a déjà vérifié l'appartenance à la boutique, mais on la refiltre ici :
    // défense en profondeur si ce SELECT venait à disparaître dans une future refactorisation.
    .where(and(eq(products.id, id), eq(products.storeId, session.storeId)))
    .returning();

  return NextResponse.json({ product: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.storeId, session.storeId)),
  });
  if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  try {
    // Le SELECT préalable a déjà vérifié l'appartenance à la boutique, mais on la refiltre ici :
    // défense en profondeur si ce SELECT venait à disparaître dans une future refactorisation.
    await db.delete(products).where(and(eq(products.id, id), eq(products.storeId, session.storeId)));
  } catch {
    return NextResponse.json(
      { error: "Impossible de supprimer ce produit : il est référencé par des ventes ou des mouvements de stock existants." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
