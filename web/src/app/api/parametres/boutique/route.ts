import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { imageEnvoyee } from "@/lib/validation/fichier";

// Onglet Boutique — §14 du cahier des charges.
// Champs éditables : logo, nom, téléphone, ville, pays (fixe l'indicatif), type de commerce,
// quartier/adresse (texte libre), note de bas de facture.

const boutiqueSchema = z.object({
  nom: z.string().min(2, "Le nom de la boutique est requis"),
  logoUrl: imageEnvoyee.nullable().optional(),
  telephone: z.string().nullable().optional(),
  ville: z.string().nullable().optional(),
  pays: z.string().min(1, "Le pays est requis"),
  indicatif: z.string().min(1, "L'indicatif est requis"),
  typeCommerce: z.string().nullable().optional(),
  quartier: z.string().nullable().optional(),
  noteBasFacture: z.string().nullable().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(session, "parametres.boutique"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  return NextResponse.json({
    nom: store.nom,
    logoUrl: store.logoUrl,
    telephone: store.telephone,
    adresse: store.adresse,
    ville: store.ville,
    quartier: store.quartier,
    pays: store.pays,
    indicatif: store.indicatif,
    typeCommerce: store.typeCommerce,
    devise: store.devise,
    noteBasFacture: store.noteBasFacture,
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "parametres.boutique"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = boutiqueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  // §14 : le quartier/adresse est un champ libre (pas d'adresse structurée) — on le stocke
  // dans `quartier` (repris comme libellé principal) et on synchronise `adresse` avec la même
  // valeur pour rester compatible avec les écrans qui liraient `adresse` (ex. reçu de vente).
  const [updated] = await db
    .update(stores)
    .set({
      nom: data.nom,
      logoUrl: data.logoUrl ?? null,
      telephone: data.telephone ?? null,
      ville: data.ville ?? null,
      pays: data.pays,
      indicatif: data.indicatif,
      typeCommerce: data.typeCommerce ?? null,
      quartier: data.quartier ?? null,
      adresse: data.quartier ?? null,
      noteBasFacture: data.noteBasFacture ?? null,
    })
    .where(eq(stores.id, session.storeId))
    .returning();

  return NextResponse.json({ ok: true, store: updated });
}
