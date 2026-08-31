import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { mobileMoneySettings } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";

// Onglet Mobile Money — §14 + §16.
//
// La configuration est désormais persistée côté serveur (table `mobile_money_settings`, une ligne
// par boutique) : elle est partagée par tous les appareils et tous les utilisateurs de la
// boutique. Elle vivait auparavant dans le localStorage du navigateur.
//
// La clé API de l'agrégateur n'est jamais renvoyée en clair : le GET n'expose que sa présence et
// ses 4 derniers caractères, de quoi vérifier qu'on a saisi la bonne sans pouvoir la relire.

const OPERATEURS = ["AIRTEL_MONEY", "MOOV_MONEY"] as const;

const configSchema = z.object({
  operateurPrioritaire: z.enum(OPERATEURS),
  numeroMarchandAirtel: z.string().trim().max(40).nullable().optional(),
  numeroMarchandMoov: z.string().trim().max(40).nullable().optional(),
  agregateurSiteId: z.string().trim().max(120).nullable().optional(),
  // Chaîne vide = ne pas modifier la clé existante ; null explicite = l'effacer.
  agregateurApiKey: z.string().max(400).nullable().optional(),
  modeProduction: z.boolean(),
});

function serialize(row: typeof mobileMoneySettings.$inferSelect | undefined) {
  return {
    operateurPrioritaire: row?.operateurPrioritaire ?? "AIRTEL_MONEY",
    numeroMarchandAirtel: row?.numeroMarchandAirtel ?? "",
    numeroMarchandMoov: row?.numeroMarchandMoov ?? "",
    agregateurSiteId: row?.agregateurSiteId ?? "",
    apiKeyDefinie: Boolean(row?.agregateurApiKey),
    apiKeyApercu: row?.agregateurApiKey ? `••••${row.agregateurApiKey.slice(-4)}` : "",
    modeProduction: row?.modeProduction ?? false,
    misAJourLe: row?.misAJourLe?.toISOString() ?? null,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.mobilemoney")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const row = await db.query.mobileMoneySettings.findFirst({
    where: eq(mobileMoneySettings.storeId, session.storeId),
  });
  return NextResponse.json({ config: serialize(row) });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.mobilemoney")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const parsed = configSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const data = parsed.data;

  const texte = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  const existing = await db.query.mobileMoneySettings.findFirst({
    where: eq(mobileMoneySettings.storeId, session.storeId),
  });

  // Clé API : undefined ou "" → on garde l'existante, null → on efface, valeur → on remplace.
  const apiKey =
    data.agregateurApiKey === null
      ? null
      : data.agregateurApiKey && data.agregateurApiKey.trim()
        ? data.agregateurApiKey.trim()
        : (existing?.agregateurApiKey ?? null);

  const valeurs = {
    operateurPrioritaire: data.operateurPrioritaire,
    numeroMarchandAirtel: texte(data.numeroMarchandAirtel),
    numeroMarchandMoov: texte(data.numeroMarchandMoov),
    agregateurSiteId: texte(data.agregateurSiteId),
    agregateurApiKey: apiKey,
    modeProduction: data.modeProduction,
    misAJourLe: new Date(),
  };

  const [row] = existing
    ? await db
        .update(mobileMoneySettings)
        .set(valeurs)
        .where(eq(mobileMoneySettings.storeId, session.storeId))
        .returning()
    : await db
        .insert(mobileMoneySettings)
        .values({ storeId: session.storeId, ...valeurs })
        .returning();

  return NextResponse.json({ ok: true, config: serialize(row) });
}
