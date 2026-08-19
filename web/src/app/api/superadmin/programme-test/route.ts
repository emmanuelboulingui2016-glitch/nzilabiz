// Superadmin — programme de test.
//
// Un lien unique, partagé aux testeurs pendant l'ouverture restreinte : celui qui l'utilise crée
// sa boutique avec accès complet et gratuit jusqu'à la date de fin. Le code et la date vivent en
// base, pas dans une variable d'environnement, pour être révocables et prolongeables sans
// redéploiement — y compris depuis un téléphone, un dimanche.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { platformSettings, stores } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";
import { lienTest, idReglages } from "@/lib/test-access";

const schema = z.object({
  actif: z.boolean(),
  // ISO ou null. Une date passée est acceptée : c'est une façon volontaire de clore le programme
  // sans supprimer le code, en gardant la trace de qui est entré par ce lien.
  expireLe: z.string().datetime().nullable().optional(),
  /** Fait tirer un nouveau code. L'ancien lien cesse immédiatement de fonctionner. */
  regenerer: z.boolean().optional(),
});

/** Code court, lisible, sans caractères ambigus : il sera dicté au téléphone et recopié à la main. */
function nouveauCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const octets = randomBytes(10);
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join("");
}

async function etat() {
  const [r] = await db.select().from(platformSettings).limit(1);
  const [compte] = await db
    .select({
      testeurs: sql<number>`count(*) filter (where programme_test)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(stores);

  return {
    code: r?.testLienCode ?? null,
    actif: r?.testLienActif ?? false,
    expireLe: r?.testLienExpireLe?.toISOString() ?? null,
    lien: r?.testLienCode ? lienTest(r.testLienCode) : null,
    boutiquesTesteuses: compte?.testeurs ?? 0,
    boutiquesTotal: compte?.total ?? 0,
  };
}

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  return NextResponse.json(await etat());
}

export async function PUT(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const id = await idReglages();
  const [actuel] = await db.select().from(platformSettings).where(eq(platformSettings.id, id));

  // Un lien activé sans code n'ouvrirait rien : on en tire un plutôt que d'enregistrer un état
  // incohérent que l'administrateur découvrirait en partageant une adresse morte.
  const code =
    parsed.data.regenerer || !actuel?.testLienCode ? nouveauCode() : actuel.testLienCode;

  await db
    .update(platformSettings)
    .set({
      testLienCode: code,
      testLienActif: parsed.data.actif,
      testLienExpireLe:
        parsed.data.expireLe === undefined
          ? actuel?.testLienExpireLe ?? null
          : parsed.data.expireLe === null
            ? null
            : new Date(parsed.data.expireLe),
      misAJourLe: new Date(),
    })
    .where(eq(platformSettings.id, id));

  return NextResponse.json(await etat());
}
