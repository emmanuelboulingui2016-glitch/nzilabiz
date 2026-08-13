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
import { and, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { clients, documents, sales } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { nextDocumentNumero, type DocumentType } from "@/components/documents/numero";

const DOCUMENT_TYPES: readonly DocumentType[] = ["FACTURE", "PROFORMA", "REMBOURSEMENT"];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "documents.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const q = (searchParams.get("q") ?? "").trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions: SQL[] = [eq(documents.storeId, session.storeId)];
  if (type && (DOCUMENT_TYPES as readonly string[]).includes(type)) {
    conditions.push(eq(documents.type, type as DocumentType));
  }
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) conditions.push(gte(documents.date, d));
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(documents.date, d));
    }
  }
  if (q) {
    const like = `%${q}%`;
    const searchOr = or(ilike(documents.numero, like), ilike(documents.clientNomLibre, like), ilike(clients.nom, like));
    if (searchOr) conditions.push(searchOr);
  }

  const rows = await db
    .select({
      id: documents.id,
      type: documents.type,
      numero: documents.numero,
      statut: documents.statut,
      date: documents.date,
      montantTotal: documents.montantTotal,
      clientNomLibre: documents.clientNomLibre,
      clientNom: clients.nom,
      saleNumero: sales.numero,
      convertieEnVenteId: documents.convertieEnVenteId,
    })
    .from(documents)
    .leftJoin(clients, eq(documents.clientId, clients.id))
    .leftJoin(sales, eq(documents.saleId, sales.id))
    .where(and(...conditions))
    .orderBy(desc(documents.date))
    .limit(300);

  const result = rows.map((r) => ({
    id: r.id,
    type: r.type,
    numero: r.numero,
    statut: r.statut,
    date: r.date.toISOString(),
    montantTotal: Number(r.montantTotal),
    clientNomAffiche: r.clientNom ?? r.clientNomLibre ?? null,
    saleNumero: r.saleNumero ?? null,
    convertieEnVenteId: r.convertieEnVenteId,
  }));

  return NextResponse.json({ documents: result });
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
