import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { refusJustificatif } from "@/lib/validation/fichier";

const STOCK_RECEIPT_MESSAGE =
  "Cette dépense a été générée depuis une réception de stock (module Stock) et ne peut pas être modifiée ou supprimée ici.";

async function loadOwnExpense(storeId: string, id: string) {
  return db.query.expenses.findFirst({
    where: and(eq(expenses.id, id), eq(expenses.storeId, storeId)),
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "depenses.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const expense = await loadOwnExpense(session.storeId, id);
  if (!expense) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });

  return NextResponse.json({ expense });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "depenses.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadOwnExpense(session.storeId, id);
  if (!existing) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
  if (existing.stockReceiptId) {
    return NextResponse.json({ error: STOCK_RECEIPT_MESSAGE }, { status: 400 });
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

  // Le justificatif est stocké en base64 dans une colonne texte : sans plafond, une seule dépense
  // pouvait y déposer plusieurs mégaoctets. L'attribut « accept » du formulaire ne vit que dans le
  // navigateur.
  const refusPJ = refusJustificatif(pieceJointeUrl);
  if (refusPJ) return NextResponse.json({ error: refusPJ }, { status: 400 });
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

  const noteStr = typeof note === "string" ? note.trim() : "";
  const description = noteStr ? `${libelle.trim()}\n${noteStr}` : libelle.trim();

  let dateValue = new Date();
  if (typeof date === "string" && date) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) dateValue = parsed;
  }

  const [updated] = await db
    .update(expenses)
    .set({
      categorie: categorie.trim(),
      description,
      montant: String(montantNum),
      date: dateValue,
      modeReglement: (modeReglement as "ESPECES" | "MOBILE_MONEY" | "CREDIT" | undefined) ?? "ESPECES",
      recurrente: isRecurrente,
      frequence: isRecurrente ? (frequence as "HEBDOMADAIRE" | "MENSUELLE") : null,
      pieceJointeUrl: typeof pieceJointeUrl === "string" && pieceJointeUrl ? pieceJointeUrl : null,
    })
    .where(and(eq(expenses.id, id), eq(expenses.storeId, session.storeId)))
    .returning();

  return NextResponse.json({ expense: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "depenses.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await loadOwnExpense(session.storeId, id);
  if (!existing) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
  if (existing.stockReceiptId) {
    return NextResponse.json({ error: STOCK_RECEIPT_MESSAGE }, { status: 400 });
  }

  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.storeId, session.storeId)));

  return NextResponse.json({ ok: true });
}
