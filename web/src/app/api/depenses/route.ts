import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { chargerDepenses } from "@/components/depenses/get-depenses-data";
import { can } from "@/lib/auth/rbac";

// Catégories suggérées pour la saisie manuelle (§10 du cahier des charges). "Rachats de stock"
// n'apparaît pas ici : cette catégorie est réservée aux dépenses générées automatiquement par le
// module Stock (flux « Réceptionner une livraison »), reconnues via stockReceiptId non nul.
// Conservé ici pour les importateurs existants ; la définition vit avec la lecture.
export { SUGGESTED_CATEGORIES } from "@/components/depenses/get-depenses-data";

/**
 * 🔧 Dépenses récurrentes — génération pragmatique sans scheduler.
 *
 * Il n'y a pas de job en arrière-plan dans cet environnement de build. À la place, à chaque
 * chargement de la liste (GET), on regarde les dépenses marquées `recurrente=true` pour cette
 * boutique, on regroupe par (catégorie, description) pour retrouver la dernière occurrence de
 * chaque dépense récurrente, et si l'intervalle (7 jours pour HEBDOMADAIRE, 30 jours pour
 * MENSUELLE) est dépassé, on insère automatiquement la prochaine occurrence datée d'aujourd'hui.
 * C'est idempotent : une fois l'occurrence du jour créée, sa date devient la référence la plus
 * récente, donc les appels suivants dans la même journée ne recréent rien.
 *
 * Limite connue : un vrai ordonnanceur (cron / job en arrière-plan) serait nécessaire pour générer
 * les échéances même quand personne n'ouvre la page, et pour envoyer un rappel avant échéance
 * (demandé par le cahier des charges) — c'est un travail futur, non couvert par cette approche.
 */
async function genererDepensesRecurrentesDues(storeId: string, fallbackUserId: string) {
  const templates = await db.query.expenses.findMany({
    where: and(eq(expenses.storeId, storeId), eq(expenses.recurrente, true)),
    orderBy: [desc(expenses.date)],
  });

  const latestByKey = new Map<string, (typeof templates)[number]>();
  for (const t of templates) {
    const key = `${t.categorie}::${t.description}`;
    if (!latestByKey.has(key)) latestByKey.set(key, t);
  }

  const now = new Date();
  const toInsert: (typeof expenses.$inferInsert)[] = [];
  for (const t of latestByKey.values()) {
    if (!t.frequence) continue;
    const intervalDays = t.frequence === "HEBDOMADAIRE" ? 7 : 30;
    const last = new Date(t.date);
    const daysSince = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince >= intervalDays) {
      toInsert.push({
        storeId,
        userId: t.userId ?? fallbackUserId,
        categorie: t.categorie,
        description: t.description,
        montant: t.montant,
        date: now,
        modeReglement: t.modeReglement,
        recurrente: true,
        frequence: t.frequence,
        pieceJointeUrl: null,
        stockReceiptId: null,
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(expenses).values(toInsert);
  }
  return toInsert.length;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "depenses.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const generatedRecurringCount = await genererDepensesRecurrentesDues(session.storeId, session.userId);

  const { searchParams } = new URL(request.url);

  return NextResponse.json({
    generatedRecurringCount,
    ...(await chargerDepenses(session.storeId, {
      periode: searchParams.get("periode"),
      categorie: searchParams.get("categorie"),
      q: searchParams.get("q"),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "depenses.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { libelle, montant, categorie, date, modeReglement, note, recurrente, frequence, pieceJointeUrl } =
    body as Record<string, unknown>;

  if (typeof libelle !== "string" || !libelle.trim()) {
    return NextResponse.json({ error: "Le libellé est requis" }, { status: 400 });
  }
  const montantNum = Number(montant);
  if (!Number.isFinite(montantNum) || montantNum <= 0) {
    return NextResponse.json({ error: "Le montant doit être un nombre positif" }, { status: 400 });
  }
  if (typeof categorie !== "string" || !categorie.trim()) {
    return NextResponse.json({ error: "La catégorie est requise" }, { status: 400 });
  }
  const isRecurrente = Boolean(recurrente);
  if (isRecurrente && frequence !== "HEBDOMADAIRE" && frequence !== "MENSUELLE") {
    return NextResponse.json(
      { error: "Choisissez une fréquence (hebdomadaire ou mensuelle) pour une dépense récurrente" },
      { status: 400 }
    );
  }
  if (modeReglement && !["ESPECES", "MOBILE_MONEY", "CREDIT"].includes(String(modeReglement))) {
    return NextResponse.json({ error: "Mode de règlement invalide" }, { status: 400 });
  }

  // 🔧 Écart documenté : le schéma partagé (`src/db/schema.ts`) n'a pas de colonne dédiée pour la
  // « Note » du formulaire (seulement `description`). On la concatène donc à la suite du libellé,
  // séparée par un saut de ligne, et on la ressépare côté affichage (premier segment = libellé,
  // reste = note). Alternative éditer schema.ts non retenue (fichier partagé hors périmètre).
  const noteStr = typeof note === "string" ? note.trim() : "";
  const description = noteStr ? `${libelle.trim()}\n${noteStr}` : libelle.trim();

  let dateValue = new Date();
  if (typeof date === "string" && date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) dateValue = parsed;
  }

  const [created] = await db
    .insert(expenses)
    .values({
      storeId: session.storeId,
      userId: session.userId,
      categorie: categorie.trim(),
      description,
      montant: String(montantNum),
      date: dateValue,
      modeReglement: (modeReglement as "ESPECES" | "MOBILE_MONEY" | "CREDIT" | undefined) ?? "ESPECES",
      recurrente: isRecurrente,
      frequence: isRecurrente ? (frequence as "HEBDOMADAIRE" | "MENSUELLE") : null,
      pieceJointeUrl: typeof pieceJointeUrl === "string" && pieceJointeUrl ? pieceJointeUrl : null,
      stockReceiptId: null,
    })
    .returning();

  return NextResponse.json({ expense: created }, { status: 201 });
}
