// POST /api/vendre — création de vente, chemin serveur autoritaire utilisé quand l'écran Vendre
// est en ligne (voir aussi /api/vendre/sync pour le rejeu des ventes mises en file hors-ligne).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createSale, CreateSaleError } from "./create-sale";

const saleSchema = z.object({
  id: z.string().min(1).optional(),
  clientId: z.string().min(1).nullable().optional(),
  remise: z.number().min(0).default(0),
  typeRemise: z.enum(["MONTANT", "POURCENTAGE"]).default("MONTANT"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantite: z.number().positive(),
      })
    )
    .min(1, "Le panier est vide."),
  payments: z
    .array(
      z.object({
        mode: z.enum(["ESPECES", "MOBILE_MONEY", "CREDIT"]),
        montant: z.number().min(0),
        montantRecu: z.number().min(0).nullable().optional(),
        monnaieRendue: z.number().nullable().optional(),
        reference: z.string().nullable().optional(),
      })
    )
    .min(1, "Un mode de paiement est requis."),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!can(session.role, "vendre.use")) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = saleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const data = parsed.data;

  try {
    const { sale, alreadyExisted } = await createSale({
      id: data.id,
      storeId: session.storeId,
      userId: session.userId,
      deviceId: session.deviceId ?? null,
      clientId: data.clientId ?? null,
      items: data.items,
      remise: data.remise,
      typeRemise: data.typeRemise,
      payments: data.payments,
    });
    return NextResponse.json({ sale, alreadyExisted }, { status: alreadyExisted ? 200 : 201 });
  } catch (err) {
    if (err instanceof CreateSaleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/vendre]", err);
    return NextResponse.json({ error: "Erreur lors de la création de la vente." }, { status: 500 });
  }
}
