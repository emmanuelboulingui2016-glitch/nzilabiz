// GET  /api/boutiques — le réseau du compte : ses boutiques, leurs chiffres du jour, ses droits.
// POST /api/boutiques — ajouter une boutique au réseau (formule Entreprise, patron uniquement).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores, storeMemberships, notificationSettings } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { etatBoutiqueCourante, bloquerSiExpiree } from "@/lib/abonnement";
import { boutiquesAccessibles, chiffresDesBoutiques, tailleDuReseau, MAX_BOUTIQUES_RESEAU } from "@/lib/reseau";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Créer une boutique, c'est créer un tenant complet. On borne, comme à l'inscription. */
const LIMITE_CREATION = { limite: 10, fenetreMs: 60 * 60_000, blocageMs: 30 * 60_000 };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const boutiques = await boutiquesAccessibles(session.userId);
  const etat = await etatBoutiqueCourante();
  const chiffres = await chiffresDesBoutiques(boutiques.map((b) => b.id));

  const entreprise = etat?.plan === "ENTREPRISE";

  return NextResponse.json({
    plan: etat?.plan ?? "ESSAI",
    entreprise,
    // Le droit d'ajouter se décide côté serveur et se répète à la création : ce drapeau ne sert
    // qu'à décider ce qu'on affiche.
    peutAjouter: entreprise && session.role === "PATRON" && boutiques.length < MAX_BOUTIQUES_RESEAU,
    maximum: MAX_BOUTIQUES_RESEAU,
    boutiqueActiveId: session.storeId,
    boutiques: boutiques.map((b) => ({
      ...b,
      active: b.id === session.storeId,
      // La maison mère porte le contrat. Sur un réseau d'une seule boutique, l'étiquette n'a pas
      // de sens et l'interface ne l'affiche pas.
      maisonMere: b.id === b.contratId,
      chiffres: chiffres.get(b.id) ?? { caJour: 0, ventesJour: 0, caMois: 0, stockBas: 0 },
    })),
  });
}

const creationSchema = z.object({
  nom: z.string().trim().min(2, "Le nom de la boutique est requis.").max(80, "Nom trop long (80 caractères maximum)."),
  ville: z.string().trim().max(80).optional().nullable(),
  quartier: z.string().trim().max(80).optional().nullable(),
  telephone: z.string().trim().max(30).optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;

  if (session.role !== "PATRON") {
    return NextResponse.json({ error: "Seul le patron peut ajouter une boutique." }, { status: 403 });
  }

  const etat = await etatBoutiqueCourante();
  if (!etat || etat.plan !== "ENTREPRISE") {
    return NextResponse.json(
      {
        error: "La gestion de plusieurs boutiques est réservée à la formule Entreprise.",
        code: "ENTREPRISE_REQUISE",
      },
      { status: 403 }
    );
  }

  // La nouvelle boutique se rattache toujours au porteur du contrat, jamais à la boutique
  // courante : sans quoi, en ajoutant depuis une boutique déjà rattachée, on créerait un réseau
  // à deux étages dont personne ne porte l'abonnement.
  const contratId = etat.contratId ?? session.storeId;

  const limite = await rateLimit(`boutique:creer:${session.userId}`, LIMITE_CREATION);
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de boutiques créées coup sur coup. Réessayez plus tard.");
  }

  const parsed = creationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  if ((await tailleDuReseau(contratId)) >= MAX_BOUTIQUES_RESEAU) {
    return NextResponse.json(
      { error: `Votre réseau atteint la limite de ${MAX_BOUTIQUES_RESEAU} boutiques. Contactez le support.` },
      { status: 409 }
    );
  }

  // Pays, indicatif, devise et langue sont repris de la maison mère. Une boutique du même réseau
  // qui démarrerait dans une autre devise afficherait des totaux faux dès la première vente, et
  // personne ne penserait à vérifier ce réglage-là.
  const mere = await db.query.stores.findFirst({
    where: eq(stores.id, contratId),
    columns: { pays: true, indicatif: true, devise: true, langueDefaut: true, plan: true, typeCommerce: true },
  });

  const [boutique] = await db
    .insert(stores)
    .values({
      nom: parsed.data.nom,
      ville: parsed.data.ville || null,
      quartier: parsed.data.quartier || null,
      telephone: parsed.data.telephone || null,
      maisonMereId: contratId,
      // Aucune date d'échéance : l'accès de cette boutique suit celui de sa maison mère. Poser
      // une date ici créerait une seconde vérité, qui finirait par diverger.
      plan: mere?.plan ?? "ENTREPRISE",
      pays: mere?.pays ?? "Gabon",
      indicatif: mere?.indicatif ?? "+241",
      devise: mere?.devise ?? "XAF",
      langueDefaut: mere?.langueDefaut ?? "fr",
      typeCommerce: mere?.typeCommerce ?? null,
    })
    .returning();

  await db.insert(notificationSettings).values({ storeId: boutique.id });

  // Le créateur y entre comme patron. Les employés, eux, se créent dans la boutique elle-même
  // depuis Paramètres → Utilisateurs, une fois qu'on y a basculé.
  await db.insert(storeMemberships).values({
    userId: session.userId,
    storeId: boutique.id,
    role: "PATRON",
  });

  return NextResponse.json({ ok: true, boutique: { id: boutique.id, nom: boutique.nom } }, { status: 201 });
}
