// Helpers de lecture serveur pour le module Paramètres > Utilisateurs (§14).

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/** Nombre de Patrons actifs pour la boutique, en excluant éventuellement un utilisateur donné. */
export async function countPatrons(storeId: string, excludeUserId?: string): Promise<number> {
  const rows = await db.query.users.findMany({
    where: excludeUserId
      ? and(eq(users.storeId, storeId), eq(users.role, "PATRON"), ne(users.id, excludeUserId))
      : and(eq(users.storeId, storeId), eq(users.role, "PATRON")),
  });
  return rows.length;
}
