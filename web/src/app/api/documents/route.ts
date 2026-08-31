// GET  /api/documents — liste des documents (Factures / Proformas / Remboursements), filtrable par
//      type, recherche (numéro, nom client) et période. §12 du cahier des charges.
// POST /api/documents — création d'un document :
//      - type=FACTURE : générée depuis une vente existante (saleId), numéro auto, statut EMISE.
//      - type=PROFORMA : créée indépendamment d'une vente (client existant OU nom libre + lignes
//        brouillon libres, non liées à de vrais Product), statut BROUILLON. 🔧 Amélioration §12 :
//        clarifie le parcours devis → vente → facture (voir /api/documents/[id]/convertir).
//      - type=REMBOURSEMENT : non pris en charge ici pour l'instant — ces documents ne sont générés
//        automatiquement nulle part encore dans ce build (voir résumé final : futur point de
//        connexion avec DebtRepayment du module Créances).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { clients, documents, sales } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nextDocumentNumero } from "@/components/documents/numero";
import { chargerDocuments } from "@/components/documents/get-documents-data";
import { bloquerSiExpiree, bloquerSiHorsFormule } from "@/lib/abonnement";


export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Fonctionnalité hors de la formule Essentiel : refusée ici, pas seulement masquée
  // dans le menu. Une route reste appelable même quand son bouton a disparu.
  const horsFormule = await bloquerSiHorsFormule("documents");
  if (horsFormule) return horsFormule;
  if (!can(session.role, "documents.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  return NextResponse.json({
    documents: await chargerDocuments(session.storeId, {
      type: searchParams.get("type"),
      q: searchParams.get("q"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    }),
  });
}

const factureSchema = z.object({
  type: z.literal("FACTURE"),
  saleId: z.string().min(1),
});

const proformaItemSchema = z.object({
  nom: z.string().min(1),
  quantite: z.coerce.number().positive(),
  prixUnitaire: z.coerce.number().min(0),
});

const proformaSchema = z.object({
  type: z.literal("PROFORMA"),
  clientId: z.string().optional().nullable(),
  clientNomLibre: z.string().optional().nullable(),
  items: z.array(proformaItemSchema).min(1),
});

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.type !== "string") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (body.type === "FACTURE") {
    const parsed = factureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
    }

    const sale = await db.query.sales.findFirst({
      where: and(eq(sales.id, parsed.data.saleId), eq(sales.storeId, session.storeId)),
    });
    if (!sale) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
    if (sale.statut !== "VALIDEE") {
      return NextResponse.json({ error: "Seule une vente validée peut être facturée." }, { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      const numero = await nextDocumentNumero(tx, session.storeId, "FACTURE");
      const [row] = await tx
        .insert(documents)
        .values({
          storeId: session.storeId,
          type: "FACTURE",
          numero,
          statut: "EMISE",
          saleId: sale.id,
          clientId: sale.clientId,
          montantTotal: sale.total,
          userId: session.userId,
        })
        .returning();
      return row;
    });

    return NextResponse.json({ document: created }, { status: 201 });
  }

  if (body.type === "PROFORMA") {
    const parsed = proformaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
    }
    const { clientId, clientNomLibre, items } = parsed.data;
    if (!clientId && !clientNomLibre?.trim()) {
      return NextResponse.json({ error: "Indiquez un client existant ou un nom de client." }, { status: 400 });
    }
    if (clientId) {
      const client = await db.query.clients.findFirst({
        where: and(eq(clients.id, clientId), eq(clients.storeId, session.storeId)),
      });
      if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    const draftItems = items.map((it) => ({
      nom: it.nom.trim(),
      quantite: it.quantite,
      prixUnitaire: it.prixUnitaire,
      sousTotal: Math.round(it.quantite * it.prixUnitaire),
    }));
    const montantTotal = draftItems.reduce((sum, it) => sum + it.sousTotal, 0);

    const created = await db.transaction(async (tx) => {
      const numero = await nextDocumentNumero(tx, session.storeId, "PROFORMA");
      const [row] = await tx
        .insert(documents)
        .values({
          storeId: session.storeId,
          type: "PROFORMA",
          numero,
          statut: "BROUILLON",
          clientId: clientId || null,
          clientNomLibre: clientId ? null : clientNomLibre!.trim(),
          itemsBrouillon: JSON.stringify(draftItems),
          montantTotal: String(montantTotal),
          userId: session.userId,
        })
        .returning();
      return row;
    });

    return NextResponse.json({ document: created }, { status: 201 });
  }

  return NextResponse.json(
    { error: "Type de document non pris en charge pour la création manuelle." },
    { status: 400 }
  );
}
