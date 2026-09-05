// POST /api/vendre — création de vente, chemin serveur autoritaire utilisé quand l'écran Vendre
// est en ligne (voir aussi /api/vendre/sync pour le rejeu des ventes mises en file hors-ligne).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, peut } from "@/lib/auth/session";
import { createSale, CreateSaleError } from "./create-sale";
import { bloquerSiExpiree } from "@/lib/abonnement";

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
        // Prix négocié au comptoir (§ demande produit du 04/09). Optionnel : omis, le prix
        // catalogue s'applique. Fourni, il n'est accepté que si l'appelant a le droit
        // `vendre.prix.modifier` — vérifié côté serveur dans createSale, jamais ici seulement
        // (voir `.finite()` : un prix qui n'est pas un nombre concret est toujours invalide, quel
        // que soit le droit de l'appelant).
        prixUnitaire: z.number().min(0).finite().optional(),
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

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "vendre.use"))) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }
  // Droit de négocier un prix au comptoir — transmis à createSale, qui refuse toute ligne dont le
  // prix déclaré diverge du catalogue si ce droit est absent. Calculé ici et non dans createSale :
  // createSale n'a pas accès à la session (voir son commentaire sur `canModifierPrix`). Ici, la
  // session qui crée la vente EST celle qui l'encaisse (chemin en ligne) : contrairement à
  // /api/vendre/sync, il n'y a pas de vendeur "réel" distinct à résoudre.
  const canModifierPrix = await peut(session, "vendre.prix.modifier");

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
      canModifierPrix,
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
