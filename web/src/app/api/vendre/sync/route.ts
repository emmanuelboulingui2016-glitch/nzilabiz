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
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { devices } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/rbac";
import { createSale, CreateSaleError } from "../create-sale";

// Tolérance de dérive d'horloge entre l'appareil et le serveur : une petite avance de l'horloge
// du téléphone ne doit pas faire rejeter une vente réellement passée à l'instant.
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
// Une vente hors-ligne légitime a au plus quelques jours de retard avant synchro (coupure réseau
// prolongée dans une zone mal couverte). Au-delà, la rétrodatation n'a plus de justification
// opérationnelle plausible et sert surtout à noyer une vente dans un rapport déjà clôturé.
const MAX_RETRODATE_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

const syncPayloadSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1).nullable().optional(),
  dateHeure: z.string().datetime().optional(),
  remise: z.number().min(0).default(0),
  typeRemise: z.enum(["MONTANT", "POURCENTAGE"]).default("MONTANT"),
  userId: z.string().min(1).optional(),
  deviceId: z.string().min(1).nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantite: z.number().positive(),
        prixUnitaire: z.number().min(0).finite(),
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
  if (!(await peut(session, "vendre.use"))) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }

  // Pas de `bloquerSiExpiree()` ici, et c'est volontaire : cette route ne crée aucune vente
  // nouvelle, elle remonte des ventes DÉJÀ encaissées hors ligne, argent en caisse à l'appui.
  // La bloquer à l'échéance de l'abonnement ferait perdre définitivement les ventes d'un
  // commerçant qui a travaillé sans réseau la veille de son expiration. Une date d'abonnement
  // ne doit jamais détruire des données déjà saisies. Ne pas « corriger » en ajoutant le garde.

  const body = await request.json().catch(() => null);
  const parsed = syncQueueEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }
  const { entite, action, payload } = parsed.data;

  if (entite !== "sale" || action !== "create") {
    return NextResponse.json({ error: "Entité ou action non prise en charge par /api/vendre/sync." }, { status: 400 });
  }

  // Rétrodatation bornée : une vente hors-ligne légitime a au plus quelques jours de retard, et
  // ne peut pas être datée dans le futur (au-delà d'une petite tolérance d'horloge). Sans borne,
  // `dateHeure` non vérifiée permettait de dater une vente à volonté pour la noyer dans une
  // période déjà close aux yeux du patron.
  if (payload.dateHeure) {
    const dateHeureMs = new Date(payload.dateHeure).getTime();
    const now = Date.now();
    if (dateHeureMs > now + CLOCK_SKEW_TOLERANCE_MS) {
      return NextResponse.json({ error: "La date de la vente ne peut pas être dans le futur." }, { status: 400 });
    }
    if (dateHeureMs < now - MAX_RETRODATE_MS) {
      return NextResponse.json(
        { error: "La date de la vente est trop ancienne pour être synchronisée (30 jours maximum)." },
        { status: 400 }
      );
    }
  }

  // Attribution à l'utilisateur/appareil qui a réellement effectué la vente hors-ligne, plutôt
  // qu'à la session qui déclenche la synchro (peut différer, ex. resynchro tardive depuis un
  // autre appareil). Mais `payload.userId`/`payload.deviceId` viennent du client : sans
  // vérification, un VENDEUR pouvait imputer sa vente à n'importe quel collègue en désignant
  // simplement son id, brouillant l'enquête du patron en cas de détournement. On ne les accepte
  // donc que s'ils appartiennent bien à la boutique de la session ; sinon on retombe sur la
  // session (requêtes séquentielles, pas de Promise.all — pooler en mode transaction).
  //
  // On récupère au passage le rôle réel de ce vendeur DANS CETTE BOUTIQUE (`users.role` pour sa
  // boutique d'origine, `store_memberships.role` s'il n'y est que rattaché — voir schema.ts) : le
  // droit de négocier un prix (`vendre.prix.modifier`, plus bas) doit s'apprécier chez celui qui a
  // réellement négocié le prix au comptoir, pas chez celui qui, plus tard, ouvre l'app en premier
  // et déclenche sans le savoir la resynchro d'un appareil partagé. Sur un appareil partagé entre
  // un vendeur A (qui a le droit) et un vendeur B (qui ne l'a pas), faire dépendre l'acceptation
  // de la vente déjà encaissée par A du rôle de B — que B se contente de relayer sans y avoir
  // négocié quoi que ce soit — bloquerait indéfiniment une vente pourtant bien réelle : exactement
  // le risque que ce correctif doit éviter (voir le rapport de l'agent).
  let resolvedUserId = session.userId;
  let resolvedRole: Role = session.role;
  if (payload.userId && payload.userId !== session.userId) {
    const [ligne] = await db.execute<{ role: Role | null }>(sql`
      select
        case
          when u.store_id = ${session.storeId} then u.role
          else (
            select m.role from store_memberships m
            where m.user_id = u.id and m.store_id = ${session.storeId}
            limit 1
          )
        end as role
      from users u
      where u.id = ${payload.userId}
    `);
    if (ligne?.role) {
      resolvedUserId = payload.userId;
      resolvedRole = ligne.role;
    }
    // Sinon (utilisateur inexistant ou n'appartenant pas à cette boutique) : on ignore
    // silencieusement l'attribution demandée plutôt que de faire échouer toute la synchro — la
    // vente elle-même, bien réelle, n'est pas perdue ; elle est juste imputée à l'auteur
    // authentifié de la requête au lieu d'un tiers désigné arbitrairement, avec son propre rôle.
  }
  // Droit de négocier un prix au comptoir — apprécié sur le vendeur réel (`resolvedUserId` /
  // `resolvedRole`, voir juste au-dessus), jamais sur `session` : `peut({ userId, role }, ...)` va
  // chercher fraîches les dérogations individuelles de CE vendeur, pas celles de la session qui
  // déclenche la resynchro. Sans ce détail, un collègue qui relaie la synchro d'un appareil partagé
  // ferait juger le droit d'après SES PROPRES dérogations plutôt que celles du vendeur qui a
  // réellement négocié le prix — pouvant bloquer une vente déjà encaissée si ce collègue n'a pas le
  // droit, ou au contraire laisser passer un prix modifié qu'il n'aurait pas dû pouvoir accepter.
  const canModifierPrix = await peut({ userId: resolvedUserId, role: resolvedRole }, "vendre.prix.modifier");

  let resolvedDeviceId = session.deviceId ?? null;
  if (payload.deviceId && payload.deviceId !== session.deviceId) {
    const device = await db.query.devices.findFirst({
      where: and(eq(devices.id, payload.deviceId), eq(devices.storeId, session.storeId)),
    });
    if (device) {
      resolvedDeviceId = payload.deviceId;
    }
  }

  try {
    const { sale, alreadyExisted } = await createSale({
      id: payload.id,
      storeId: session.storeId,
      userId: resolvedUserId,
      deviceId: resolvedDeviceId,
      clientId: payload.clientId ?? null,
      dateHeure: payload.dateHeure ? new Date(payload.dateHeure) : undefined,
      items: payload.items,
      remise: payload.remise,
      typeRemise: payload.typeRemise,
      payments: payload.payments,
      canModifierPrix,
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
