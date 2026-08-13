// Génération du numéro séquentiel des documents (F-0001, PF-0001, R-0001, par boutique + par type).
// Même stratégie que genSaleNumber (src/lib/utils.ts, utilisé par src/app/api/vendre/create-sale.ts) :
// verrou consultatif Postgres transactionnel (pg_advisory_xact_lock) pour éviter les collisions de
// numéro sous concurrence, puis comptage des documents existants du même type pour cette boutique.

import { and, eq, sql } from "drizzle-orm";
import { documents } from "@/db/schema";

export type DocumentType = "FACTURE" | "PROFORMA" | "REMBOURSEMENT";

const PREFIXES: Record<DocumentType, string> = {
  FACTURE: "F",
  PROFORMA: "PF",
  REMBOURSEMENT: "R",
};

export function genDocumentNumero(type: DocumentType, seq: number): string {
  return `${PREFIXES[type]}-${String(seq).padStart(4, "0")}`;
}

// `tx` doit être une transaction Drizzle active (db.transaction(async (tx) => ...)) — le verrou
// consultatif est libéré automatiquement à la fin de la transaction. Typé `any` volontairement :
// le type exact d'une PgTransaction Drizzle est un générique interne peu pratique à référencer ici,
// et cet helper n'est utilisé qu'en interne par les routes API du module Documents.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function nextDocumentNumero(tx: any, storeId: string, type: DocumentType): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${storeId + ":" + type}))`);
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.storeId, storeId), eq(documents.type, type)));
  return genDocumentNumero(type, (count ?? 0) + 1);
}
