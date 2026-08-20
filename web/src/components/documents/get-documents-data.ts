// Chargement de la liste des documents (factures, proformas) — source unique, partagée par la page
// serveur et par GET /api/documents. La page rend la liste déjà remplie : sans cela le navigateur
// devait la redemander aussitôt après affichage, soit un aller-retour de plus.

import { and, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, documents, sales } from "@/db/schema";
import { type DocumentType } from "@/components/documents/numero";

const DOCUMENT_TYPES: readonly DocumentType[] = ["FACTURE", "PROFORMA", "REMBOURSEMENT"];

export type FiltresDocuments = {
  type?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
};

export async function chargerDocuments(storeId: string, filtres: FiltresDocuments = {}) {
  const type = filtres.type ?? null;
  const q = (filtres.q ?? "").trim();
  const from = filtres.from ?? null;
  const to = filtres.to ?? null;

  const conditions: SQL[] = [eq(documents.storeId, storeId)];
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

  return result;
}
