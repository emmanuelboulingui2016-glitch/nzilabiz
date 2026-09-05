// GET /api/superadmin/tarifs — grille en vigueur
// PUT /api/superadmin/tarifs — modifier les prix des formules

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { planTarifs } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";
import { CYCLES, PLANS_TARIFES, TARIFS_DEFAUT } from "@/lib/tarifs";
import { lireTarifs } from "@/lib/tarifs-serveur";

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  return NextResponse.json({ tarifs: await lireTarifs(), defauts: TARIFS_DEFAUT });
}

const schema = z.object({
  tarifs: z
    .array(
      z.object({
        plan: z.enum(PLANS_TARIFES),
        cycle: z.enum(["mensuel", "trimestriel", "annuel"]),
        /**
         * `null` efface la ligne : le tarif du code reprend la main. C'est la façon de revenir en
         * arrière sans avoir à retrouver le montant d'origine.
         */
        montant: z.number().int().min(0).max(100_000_000).nullable(),
      })
    )
    .min(1)
    .max(PLANS_TARIFES.length * CYCLES.length),
});

export async function PUT(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // Entreprise n'a plus de tarif public : il se négocie boutique par boutique (voir
  // `stores.tarifNegocie*` et `src/lib/paiements.ts`). Refusé ici, à la source, même si le
  // formulaire ne peut plus en envoyer — un appel direct à cette route ne doit pas rouvrir la
  // porte que l'interface a fermée.
  if (parsed.data.tarifs.some((t) => t.plan === "ENTREPRISE")) {
    return NextResponse.json(
      { error: "Le tarif Entreprise n'est plus public ; fixez-le depuis la fiche de la boutique concernée." },
      { status: 400 }
    );
  }

  // Enchaînées, jamais en parallèle : le pooler en mode transaction ne rend pas la main quand
  // plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  for (const t of parsed.data.tarifs) {
    const ou = and(eq(planTarifs.plan, t.plan), eq(planTarifs.cycle, t.cycle));

    if (t.montant === null) {
      await db.delete(planTarifs).where(ou);
      continue;
    }

    const existant = await db.query.planTarifs.findFirst({ where: ou });
    if (existant) {
      await db
        .update(planTarifs)
        .set({ montant: String(t.montant), misAJourLe: new Date() })
        .where(eq(planTarifs.id, existant.id));
    } else {
      await db.insert(planTarifs).values({ plan: t.plan, cycle: t.cycle, montant: String(t.montant) });
    }
  }

  // La page tarifs publique est pré-générée : sans cette purge, elle afficherait l'ancien prix
  // jusqu'au prochain déploiement — exactement ce que cet écran promet d'éviter.
  revalidatePath("/");

  return NextResponse.json({ ok: true, tarifs: await lireTarifs() });
}
