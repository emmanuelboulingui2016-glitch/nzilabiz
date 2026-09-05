// POST /api/vendre/clients — création rapide d'un client depuis la caisse.
//
// Endpoint distinct de /api/clients volontairement : créer une fiche client complète (limite de
// crédit, notes, conditions de paiement) demande la permission `clients.edit`, réservée au Patron
// et au Gérant. Mais le vendeur au comptoir doit pouvoir enregistrer un nouveau client au moment
// où il encaisse, sinon la vente part sans client et le suivi de fidélité ne se construit jamais.
// D'où cette création minimale — nom + téléphone — ouverte à quiconque tient la caisse.

import { NextResponse } from "next/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { bloquerSiExpiree } from "@/lib/abonnement";

const schema = z.object({
  nom: z.string().trim().min(1, "Le nom du client est requis.").max(120),
  telephone: z.string().trim().max(40).optional().nullable(),
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

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const nom = parsed.data.nom;

  // Un même client saisi deux fois au comptoir fausserait tout son historique d'achats :
  // on renvoie la fiche existante plutôt que d'en créer une seconde.
  const existant = await db.query.clients.findFirst({
    where: and(eq(clients.storeId, session.storeId), ilike(clients.nom, nom), eq(clients.archive, false)),
  });
  if (existant) {
    return NextResponse.json({
      client: { id: existant.id, nom: existant.nom, telephone: existant.telephone },
      existant: true,
    });
  }

  const [cree] = await db
    .insert(clients)
    .values({
      storeId: session.storeId,
      nom,
      telephone: parsed.data.telephone?.trim() || null,
    })
    .returning();

  return NextResponse.json(
    { client: { id: cree.id, nom: cree.nom, telephone: cree.telephone }, existant: false },
    { status: 201 }
  );
}
