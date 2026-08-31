import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, products } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { CATALOG_TEMPLATES } from "@/lib/onboarding/templates";
import { genProductRef } from "@/lib/utils";
import { bloquerSiExpiree } from "@/lib/abonnement";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;

  // Cette route crée des catégories et des produits : c'est une écriture de stock, soumise au même
  // droit que toutes les autres. Elle ne le vérifiait pas — un vendeur, qui n'a pourtant que la
  // lecture du stock, pouvait injecter un catalogue entier dans la boutique de son patron.
  if (!can(session.role, "stock.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { templateId } = await request.json().catch(() => ({ templateId: null }));
  const template = CATALOG_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return NextResponse.json({ error: "Modèle inconnu" }, { status: 400 });

  const categoryCache = new Map<string, string>();

  for (const p of template.products) {
    let categoryId = categoryCache.get(p.categorie);
    if (!categoryId) {
      const existing = await db.query.categories.findFirst({
        where: and(eq(categories.storeId, session.storeId), eq(categories.nom, p.categorie)),
      });
      if (existing) {
        categoryId = existing.id;
      } else {
        const [created] = await db.insert(categories).values({ storeId: session.storeId, nom: p.categorie }).returning();
        categoryId = created.id;
      }
      categoryCache.set(p.categorie, categoryId);
    }

    await db.insert(products).values({
      storeId: session.storeId,
      reference: genProductRef(),
      nom: p.nom,
      categoryId,
      prixAchat: String(p.prixAchat),
      prixVente: String(p.prixVente),
      unite: p.unite,
      quantiteStock: "10",
      seuilAlerte: "5",
    });
  }

  return NextResponse.json({ ok: true, count: template.products.length });
}
