import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";

// Onglet Devise — §14 "🔧 Amélioration" du cahier des charges : sélection réelle de la devise
// (FCFA par défaut, options hors zone CEMAC pour une future expansion).
//
// La devise ET le taux de change manuel sont persistés en base (`stores.devise`,
// `stores.taux_change_manuel`) : le taux vivait auparavant dans le localStorage du navigateur,
// donc perdu au changement d'appareil et différent pour chaque utilisateur de la boutique.
export const SUPPORTED_CURRENCIES = ["XAF", "EUR", "USD"] as const;

const deviseSchema = z.object({
  devise: z.enum(SUPPORTED_CURRENCIES),
  // Taux manuel : null ou absent = pas de taux enregistré (cas normal en FCFA).
  tauxChangeManuel: z.union([z.number().positive(), z.null()]).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.devise")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  return NextResponse.json({
    devise: store.devise,
    tauxChangeManuel: store.tauxChangeManuel !== null ? Number(store.tauxChangeManuel) : null,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.devise")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deviseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Devise invalide" }, { status: 400 });
  }

  const majTaux =
    parsed.data.devise === "XAF"
      ? // La devise de référence ne peut pas avoir de taux vers elle-même.
        { tauxChangeManuel: null }
      : parsed.data.tauxChangeManuel === undefined
        ? {}
        : { tauxChangeManuel: parsed.data.tauxChangeManuel === null ? null : String(parsed.data.tauxChangeManuel) };

  const [updated] = await db
    .update(stores)
    .set({ devise: parsed.data.devise, ...majTaux })
    .where(eq(stores.id, session.storeId))
    .returning();

  return NextResponse.json({
    ok: true,
    devise: updated.devise,
    tauxChangeManuel: updated.tauxChangeManuel !== null ? Number(updated.tauxChangeManuel) : null,
  });
}
