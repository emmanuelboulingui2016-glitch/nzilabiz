// Superadmin — réglages de la plateforme.
//
// Ce que l'administrateur renseigne ici part directement sur le site public (coordonnées de
// support, mentions légales) et dans l'aide de l'application. Aucun déploiement nécessaire.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { platformSettings } from "@/db/schema";
import { getSuperAdminSession } from "@/lib/auth/superadmin";
import { getPlatformSettings } from "@/lib/platform-settings";

const texteOptionnel = z.string().trim().max(400).nullable().optional();

const schema = z.object({
  nomApplication: z.string().trim().min(1).max(80),
  slogan: z.string().trim().min(1).max(200),
  supportTelephone: texteOptionnel,
  supportWhatsapp: texteOptionnel,
  supportEmail: texteOptionnel,
  supportHoraires: texteOptionnel,
  annonce: z.string().trim().max(500).nullable().optional(),
  annonceActive: z.boolean(),
  editeurRaisonSociale: texteOptionnel,
  editeurFormeJuridique: texteOptionnel,
  editeurAdresse: texteOptionnel,
  editeurImmatriculation: texteOptionnel,
  editeurDirecteurPublication: texteOptionnel,
  hebergeurNom: texteOptionnel,
  hebergeurAdresse: texteOptionnel,
  hebergeurPays: texteOptionnel,
  droitApplicable: texteOptionnel,
  juridictionCompetente: texteOptionnel,
  autoriteProtectionDonnees: texteOptionnel,
  facebookUrl: texteOptionnel,
  instagramUrl: texteOptionnel,
  tiktokUrl: texteOptionnel,
});

export async function GET() {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  return NextResponse.json({ reglages: await getPlatformSettings() });
}

export async function PUT(request: Request) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const vide = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const valeurs = {
    ...parsed.data,
    supportTelephone: vide(parsed.data.supportTelephone),
    supportWhatsapp: vide(parsed.data.supportWhatsapp),
    supportEmail: vide(parsed.data.supportEmail),
    supportHoraires: vide(parsed.data.supportHoraires),
    annonce: vide(parsed.data.annonce),
    editeurRaisonSociale: vide(parsed.data.editeurRaisonSociale),
    editeurFormeJuridique: vide(parsed.data.editeurFormeJuridique),
    editeurAdresse: vide(parsed.data.editeurAdresse),
    editeurImmatriculation: vide(parsed.data.editeurImmatriculation),
    editeurDirecteurPublication: vide(parsed.data.editeurDirecteurPublication),
    hebergeurNom: vide(parsed.data.hebergeurNom),
    hebergeurAdresse: vide(parsed.data.hebergeurAdresse),
    hebergeurPays: vide(parsed.data.hebergeurPays),
    droitApplicable: vide(parsed.data.droitApplicable),
    juridictionCompetente: vide(parsed.data.juridictionCompetente),
    autoriteProtectionDonnees: vide(parsed.data.autoriteProtectionDonnees),
    facebookUrl: vide(parsed.data.facebookUrl),
    instagramUrl: vide(parsed.data.instagramUrl),
    tiktokUrl: vide(parsed.data.tiktokUrl),
    misAJourLe: new Date(),
  };

  const existant = await db.query.platformSettings.findFirst();
  const [ligne] = existant
    ? await db.update(platformSettings).set(valeurs).where(eq(platformSettings.id, existant.id)).returning()
    : await db.insert(platformSettings).values(valeurs).returning();

  // Les pages publiques sont pré-générées : sans cette invalidation, elles continueraient
  // d'afficher les anciennes mentions légales jusqu'au prochain déploiement — exactement ce que
  // cet écran promet d'éviter. On purge celles qui lisent ces réglages.
  for (const chemin of ["/", "/mentions-legales", "/conditions", "/confidentialite", "/cookies", "/mot-de-passe-oublie"]) {
    revalidatePath(chemin);
  }

  return NextResponse.json({ ok: true, reglages: ligne });
}
