// Créances — §9 du cahier des charges.
// GET  : liste des clients de la boutique avec solde créance calculé + jours de retard.
// POST : création d'un client (avec limite de crédit / échéance personnalisées — 🔧 amélioration).
//
// Solde d'un client = somme des `total` de ses ventes VALIDEE ayant au moins un Payment en mode
// CREDIT, moins la somme des DebtRepayment.montant du client (calculé côté serveur ici).

import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db/client";
import { clients, sales, debtRepayments, notificationSettings } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

const DEFAULT_ECHEANCE_JOURS = 30;

function n(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? 0 : num;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "creances.view")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const [allClients, creditSalesRows, settings] = await Promise.all([
    db.query.clients.findMany({
      where: eq(clients.storeId, session.storeId),
      orderBy: (c, { asc }) => [asc(c.nom)],
    }),
    db.query.sales.findMany({
      where: and(eq(sales.storeId, session.storeId), eq(sales.statut, "VALIDEE")),
      columns: { id: true, numero: true, clientId: true, total: true, dateHeure: true },
      with: { payments: { columns: { mode: true } } },
      orderBy: (s, { asc }) => [asc(s.dateHeure)],
    }),
    db.query.notificationSettings.findFirst({
      where: eq(notificationSettings.storeId, session.storeId),
      columns: { creanceRetardJours: true },
    }),
  ]);

  const clientIds = allClients.map((c) => c.id);
  const storeRepayments = clientIds.length
    ? await db.query.debtRepayments.findMany({
        where: inArray(debtRepayments.clientId, clientIds),
        columns: { id: true, clientId: true, montant: true, date: true },
      })
    : [];

  const storeCreditSales = creditSalesRows.filter(
    (s) => s.clientId && s.payments.some((p) => p.mode === "CREDIT")
  );

  const today = new Date();
  const fallbackEcheance = settings?.creanceRetardJours ?? DEFAULT_ECHEANCE_JOURS;

  const result = allClients.map((client) => {
    const clientSales = storeCreditSales
      .filter((s) => s.clientId === client.id)
      .sort((a, b) => a.dateHeure.getTime() - b.dateHeure.getTime());
    const totalCredit = clientSales.reduce((sum, s) => sum + n(s.total), 0);
    const totalRembourse = storeRepayments
      .filter((r) => r.clientId === client.id)
      .reduce((sum, r) => sum + n(r.montant), 0);
    const solde = totalCredit - totalRembourse;

    const echeanceEffective = client.echeanceJours ?? fallbackEcheance;

    // Applique les remboursements FIFO aux ventes à crédit (les plus anciennes d'abord) pour
    // déterminer la première vente encore impayée, base du calcul des jours de retard.
    let remaining = totalRembourse;
    let dateEcheance: string | null = null;
    let joursRetard: number | null = null;
    for (const s of clientSales) {
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

    return {
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
    };
  });

  return NextResponse.json({ clients: result });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "creances.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.nom !== "string" || !body.nom.trim()) {
    return NextResponse.json({ error: "Le nom du client est requis" }, { status: 400 });
  }

  const [created] = await db
    .insert(clients)
    .values({
      storeId: session.storeId,
      nom: body.nom.trim(),
      telephone: typeof body.telephone === "string" && body.telephone.trim() ? body.telephone.trim() : null,
      limiteCredit:
        body.limiteCredit !== undefined && body.limiteCredit !== null && body.limiteCredit !== ""
          ? String(body.limiteCredit)
          : null,
      echeanceJours:
        body.echeanceJours !== undefined && body.echeanceJours !== null && body.echeanceJours !== ""
          ? Number(body.echeanceJours)
          : null,
    })
    .returning();

  return NextResponse.json({ client: created }, { status: 201 });
}
