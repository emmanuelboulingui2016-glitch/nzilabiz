// POST /api/vendre/sync — rejoue une mutation de vente mise en file par le moteur de synchro
// hors-ligne (`src/lib/offline/sync-engine.ts`). Reçoit l'enveloppe `SyncQueueEntry` telle quelle
// (voir `src/lib/offline/db.ts`) et applique la même logique de création que POST /api/vendre,
// mais en respectant les prix figés capturés côté client au moment réel de la vente (et non les
// prix courants du produit, qui peuvent avoir changé entre la vente hors-ligne et la synchro).
//
// Idempotent sur `payload.id` (id de vente généré côté client / Dexie) : rejouer la même entrée
// plusieurs fois (retries réseau) ne crée jamais de doublon.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createSale, CreateSaleError } from "../create-sale";

const syncPayloadSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1).nullable().optional(),
  dateHeure: z.string().optional(),
  remise: z.number().min(0).default(0),
  typeRemise: z.enum(["MONTANT", "POURCENTAGE"]).default("MONTANT"),
  userId: z.string().min(1).optional(),
  deviceId: z.string().min(1).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantite: z.number().positive(),
        prixUnitaire: z.number().min(0),
        prixAchatUnitaire: z.number().min(0),
      })
    )
    .min(1),
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
    .min(1),
});

const syncQueueEntrySchema = z.object({
  entite: z.literal("sale"),
  entiteId: z.string().min(1),
  action: z.enum(["create", "update", "delete"]),
  payload: syncPayloadSchema,
  userId: z.string().min(1),
  deviceId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!can(session.role, "vendre.use")) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = syncQueueEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const { entite, action, payload } = parsed.data;

  if (entite !== "sale" || action !== "create") {
    return NextResponse.json({ error: "Entité ou action non prise en charge par /api/vendre/sync." }, { status: 400 });
  }

  try {
    const { sale, alreadyExisted } = await createSale({
      id: payload.id,
      storeId: session.storeId,
      // Attribution à l'utilisateur/appareil qui a réellement effectué la vente hors-ligne,
      // plutôt qu'à la session qui déclenche la synchro (peut différer, ex. resynchro tardive).
      userId: payload.userId ?? session.userId,
      deviceId: payload.deviceId ?? session.deviceId ?? null,
      clientId: payload.clientId ?? null,
      dateHeure: payload.dateHeure ? new Date(payload.dateHeure) : undefined,
      items: payload.items,
      remise: payload.remise,
      typeRemise: payload.typeRemise,
      payments: payload.payments,
    });
    return NextResponse.json({ sale, alreadyExisted }, { status: alreadyExisted ? 200 : 201 });
  } catch (err) {
    if (err instanceof CreateSaleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/vendre/sync]", err);
    return NextResponse.json({ error: "Erreur lors de la synchronisation de la vente." }, { status: 500 });
  }
}
