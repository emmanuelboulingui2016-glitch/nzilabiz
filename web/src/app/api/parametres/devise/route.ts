import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

// Onglet Devise — §14 "🔧 Amélioration" du cahier des charges : sélection réelle de la devise
// (FCFA par défaut, options hors zone CEMAC pour une future expansion).
//
// ⚠️ Écart connu : le schéma `stores` n'a pas de champ pour un taux de change manuel. Cette route
// ne persiste QUE la devise (`stores.devise`, champ réel). Voir le résumé de fin de tâche pour le
// détail de ce qui manque côté schéma pour un taux de change persistant.
export const SUPPORTED_CURRENCIES = ["XAF", "EUR", "USD"] as const;

const deviseSchema = z.object({
  devise: z.enum(SUPPORTED_CURRENCIES),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.devise")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  return NextResponse.json({ devise: store.devise });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.devise")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deviseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Devise invalide" }, { status: 400 });
  }

  const [updated] = await db
    .update(stores)
    .set({ devise: parsed.data.devise })
    .where(eq(stores.id, session.storeId))
    .returning();

  return NextResponse.json({ ok: true, devise: updated.devise });
}
