// POST /api/documents/[id]/convertir — transforme une Proforma (statut BROUILLON) en une vraie
// Vente, "sans ressaisie" (§12 Amélioration : parcours devis → vente → facture).
//
// Point structurellement délicat de ce module : Sale/SaleItem exigent un `productId` réel
// (contrainte du schéma), alors qu'une Proforma autonome est créée avec des lignes brouillon
// libres (`itemsBrouillon`, simple texte JSON — nom/quantité/prix saisis à la main, qui ne
// correspondent pas forcément à un Product existant). On ne peut donc PAS convertir automatiquement
// sans intervention : l'UX retenue est une étape de mapping explicite, où l'utilisateur associe
// chaque ligne brouillon à un produit réel du catalogue (avec quantité/prix pré-remplis, modifiables)
// avant de confirmer — voir ConvertProformaDialog. Le corps de la requête attend donc `lignes`,
// un tableau positionnellement aligné avec `itemsBrouillon` de la proforma.
//
// Tout se déroule dans UNE transaction Drizzle unique (Sale + SaleItems + Payment + décrément stock
// + StockMovement + mise à jour du document Proforma d'origine + création du nouveau document
// Facture), en suivant exactement les mêmes conventions que src/app/api/vendre/create-sale.ts
// (verrou consultatif pour la numérotation, décrément atomique du stock, mouvement de stock
// négatif de type VENTE). On ne réutilise pas createSale() directement car elle gère elle-même sa
// propre transaction de haut niveau et ne peut pas être composée avec les écritures supplémentaires
// sur `documents` dans une seule transaction atomique — voir résumé final.
//
// Sur le document Proforma d'origine : statut -> CONVERTIE, convertieEnVenteId -> id de la nouvelle
// vente. Un second document (type=FACTURE, statut=EMISE, saleId=nouvelle vente) est créé pour que
// la facture existe immédiatement, sans ressaisie, une fois le paiement confirmé.
//
// Client sans fiche existante : si la proforma n'a qu'un `clientNomLibre` (client professionnel
// texte libre, pas encore enregistré), un vrai Client est créé à la volée à partir de ce nom, car
// Sale.clientId référence un Client réel (obligatoire notamment pour un paiement CREDIT, qui doit
// pouvoir être suivi dans le module Créances).

import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { clients, documents, payments, products, saleItems, sales, stockMovements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { genSaleNumber } from "@/lib/utils";
import { genDocumentNumero } from "@/components/documents/numero";
import type { DraftItem } from "@/components/documents/types";
import { bloquerSiExpiree, bloquerSiHorsFormule } from "@/lib/abonnement";

const ligneSchema = z.object({
  productId: z.string().min(1),
  quantite: z.coerce.number().positive(),
  prixUnitaire: z.coerce.number().min(0),
});

const bodySchema = z.object({
  modePaiement: z.enum(["ESPECES", "MOBILE_MONEY", "CREDIT"]),
  lignes: z.array(ligneSchema).min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Fonctionnalité hors de la formule Essentiel : refusée ici, pas seulement masquée
  // dans le menu. Une route reste appelable même quand son bouton a disparu.
  const horsFormule = await bloquerSiHorsFormule("documents");
  if (horsFormule) return horsFormule;

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "documents.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { modePaiement, lignes } = parsed.data;

  const proforma = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.storeId, session.storeId)),
  });
  if (!proforma) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (proforma.type !== "PROFORMA") {
    return NextResponse.json({ error: "Seule une proforma peut être transformée en vente." }, { status: 400 });
  }
  if (proforma.statut !== "BROUILLON") {
    return NextResponse.json({ error: "Cette proforma a déjà été transformée ou n'est plus modifiable." }, { status: 400 });
  }

  let draftItems: DraftItem[] = [];
  try {
    draftItems = proforma.itemsBrouillon ? JSON.parse(proforma.itemsBrouillon) : [];
  } catch {
    draftItems = [];
  }
  if (draftItems.length === 0) {
    return NextResponse.json({ error: "Cette proforma ne contient aucune ligne à convertir." }, { status: 400 });
  }
  if (lignes.length !== draftItems.length) {
    return NextResponse.json(
      { error: "Chaque ligne de la proforma doit être associée à un produit réel du catalogue." },
      { status: 400 }
    );
  }

  const productIds = [...new Set(lignes.map((l) => l.productId))];
  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, session.storeId), inArray(products.id, productIds)));
  const byId = new Map(productRows.map((p) => [p.id, p]));
  for (const l of lignes) {
    if (!byId.has(l.productId)) {
      return NextResponse.json({ error: "Produit introuvable ou n'appartenant pas à cette boutique." }, { status: 400 });
    }
  }

  if (modePaiement === "CREDIT" && !proforma.clientId && !proforma.clientNomLibre) {
    return NextResponse.json({ error: "Un client est requis pour une vente à crédit." }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Sérialise numérotation vente + décrément stock pour cette boutique (même stratégie que
      // src/app/api/vendre/create-sale.ts).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.storeId}))`);

      let clientId: string | null = proforma.clientId;
      if (!clientId && proforma.clientNomLibre) {
        const [newClient] = await tx
          .insert(clients)
          .values({ storeId: session.storeId, nom: proforma.clientNomLibre })
          .returning();
        clientId = newClient.id;
      }

      let sousTotal = 0;
      const resolvedItems = lignes.map((l) => {
        const product = byId.get(l.productId)!;
        const ligneSousTotal = Math.round(l.prixUnitaire * l.quantite);
        sousTotal += ligneSousTotal;
        return {
          productId: l.productId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          prixAchatUnitaire: Number(product.prixAchat),
          sousTotal: ligneSousTotal,
        };
      });
      const total = sousTotal;

      const [{ count: saleCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(sales)
        .where(eq(sales.storeId, session.storeId));
      const saleNumero = genSaleNumber((saleCount ?? 0) + 1);

      const [insertedSale] = await tx
        .insert(sales)
        .values({
          storeId: session.storeId,
          numero: saleNumero,
          userId: session.userId,
          deviceId: session.deviceId ?? null,
          clientId,
          sousTotal: String(sousTotal),
          remise: "0",
          typeRemise: "MONTANT",
          total: String(total),
        })
        .returning();

      await tx.insert(saleItems).values(
        resolvedItems.map((i) => ({
          saleId: insertedSale.id,
          productId: i.productId,
          quantite: String(i.quantite),
          prixUnitaire: String(i.prixUnitaire),
          prixAchatUnitaire: String(i.prixAchatUnitaire),
          sousTotal: String(i.sousTotal),
        }))
      );

      await tx.insert(payments).values({
        saleId: insertedSale.id,
        mode: modePaiement,
        montant: String(total),
      });

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
          userId: session.userId,
          saleId: insertedSale.id,
        });
      }

      // Numéro de la facture générée automatiquement pour cette vente issue de la proforma.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.storeId + ":FACTURE"}))`);
      const [{ count: factureCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(and(eq(documents.storeId, session.storeId), eq(documents.type, "FACTURE")));
      const factureNumero = genDocumentNumero("FACTURE", (factureCount ?? 0) + 1);

      const [facture] = await tx
        .insert(documents)
        .values({
          storeId: session.storeId,
          type: "FACTURE",
          numero: factureNumero,
          statut: "EMISE",
          saleId: insertedSale.id,
          clientId,
          montantTotal: String(total),
          userId: session.userId,
        })
        .returning();

      const [updatedProforma] = await tx
        .update(documents)
        .set({
          statut: "CONVERTIE",
          convertieEnVenteId: insertedSale.id,
          clientId,
        })
        .where(eq(documents.id, proforma.id))
        .returning();

      return { sale: insertedSale, facture, proforma: updatedProforma };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return NextResponse.json({ error: "Conflit de numérotation, réessayez." }, { status: 409 });
    }
    throw err;
  }
}
