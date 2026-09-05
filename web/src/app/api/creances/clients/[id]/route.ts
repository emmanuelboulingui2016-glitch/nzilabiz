// Créances — fiche client : historique des ventes à crédit + remboursements, et mise à jour des
// conditions de crédit personnalisées (limite de crédit / échéance de paiement — amélioration).

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db/client";
import { clients, sales, debtRepayments, notificationSettings } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { bloquerSiExpiree } from "@/lib/abonnement";

const DEFAULT_ECHEANCE_JOURS = 30;

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!(await peut(session, "creances.view"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.storeId, session.storeId)),
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  // Enchaînées et non lancées ensemble : voir README, le pooler en mode transaction ne rend pas
  // la main quand plusieurs requêtes partent en parallèle depuis une même requête HTTP.
  const clientSalesRaw = await db.query.sales.findMany({
    where: and(eq(sales.storeId, session.storeId), eq(sales.statut, "VALIDEE"), eq(sales.clientId, id)),
    columns: { id: true, numero: true, total: true, dateHeure: true },
    with: { payments: { columns: { mode: true } } },
    orderBy: (s, { asc }) => [asc(s.dateHeure)],
  });
  const clientRepayments = await db.query.debtRepayments.findMany({
    where: eq(debtRepayments.clientId, id),
    orderBy: (r, { desc }) => [desc(r.date)],
  });
  const settings = await db.query.notificationSettings.findFirst({
    where: eq(notificationSettings.storeId, session.storeId),
    columns: { creanceRetardJours: true },
  });


  const clientCreditSales = clientSalesRaw.filter((s) => s.payments.some((p) => p.mode === "CREDIT"));
  const totalCredit = clientCreditSales.reduce((sum, s) => sum + n(s.total), 0);
  const totalRembourse = clientRepayments.reduce((sum, r) => sum + n(r.montant), 0);
  const solde = totalCredit - totalRembourse;

  const echeanceEffective = client.echeanceJours ?? settings?.creanceRetardJours ?? DEFAULT_ECHEANCE_JOURS;
  const today = new Date();

  let remaining = totalRembourse;
  let dateEcheance: string | null = null;
  let joursRetard: number | null = null;
  for (const s of clientCreditSales) {
    const montant = n(s.total);
    if (remaining >= montant) {
      remaining -= montant;
      continue;
    }
    const due = new Date(s.dateHeure);
    due.setDate(due.getDate() + echeanceEffective);
    const diff = differenceInCalendarDays(today, due);
    dateEcheance = due.toISOString();
    joursRetard = diff > 0 ? diff : null;
    break;
  }

  return NextResponse.json({
    client: {
      id: client.id,
      nom: client.nom,
      telephone: client.telephone,
      limiteCredit: client.limiteCredit !== null ? n(client.limiteCredit) : null,
      echeanceJours: client.echeanceJours,
      echeanceEffective,
      solde,
      totalCredit,
      totalRembourse,
      dateEcheance,
      joursRetard,
      depassementLimite: client.limiteCredit !== null ? solde > n(client.limiteCredit) : false,
      creeLe: client.creeLe.toISOString(),
    },
    ventes: clientCreditSales
      .slice()
      .sort((a, b) => b.dateHeure.getTime() - a.dateHeure.getTime())
      .map((s) => ({ id: s.id, numero: s.numero, dateHeure: s.dateHeure.toISOString(), total: n(s.total) })),
    remboursements: clientRepayments.map((r) => ({
      id: r.id,
      montant: n(r.montant),
      mode: r.mode,
      date: r.date.toISOString(),
      saleId: r.saleId,
    })),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "creances.edit"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.storeId, session.storeId)),
  });
  if (!existing) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const updates: Partial<typeof clients.$inferInsert> = {};
  if (typeof body.nom === "string" && body.nom.trim()) updates.nom = body.nom.trim();
  if ("telephone" in body) {
    updates.telephone = typeof body.telephone === "string" && body.telephone.trim() ? body.telephone.trim() : null;
  }
  if ("limiteCredit" in body) {
    updates.limiteCredit =
      body.limiteCredit === null || body.limiteCredit === "" || body.limiteCredit === undefined
        ? null
        : String(body.limiteCredit);
  }
  if ("echeanceJours" in body) {
    updates.echeanceJours =
      body.echeanceJours === null || body.echeanceJours === "" || body.echeanceJours === undefined
        ? null
        : Number(body.echeanceJours);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const [updated] = await db.update(clients).set(updates).where(eq(clients.id, id)).returning();
  return NextResponse.json({ client: updated });
}
