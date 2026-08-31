// Créances — onglet « Remboursements reçus » : historique des DebtRepayment de la boutique
// (jointure sur le nom du client), et enregistrement d'un nouveau remboursement.

import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, debtRepayments, sales } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";

const ALLOWED_MODES = new Set(["ESPECES", "MOBILE_MONEY", "CREDIT"]);

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

  // Pas de relation déclarée dans schema.ts entre debtRepayments et clients (schéma partagé, non
  // modifiable) : jointure explicite pour filtrer par storeId et récupérer le nom du client.
  const storeRows = await db
    .select({
      id: debtRepayments.id,
      clientId: debtRepayments.clientId,
      clientNom: clients.nom,
      montant: debtRepayments.montant,
      mode: debtRepayments.mode,
      date: debtRepayments.date,
      saleId: debtRepayments.saleId,
    })
    .from(debtRepayments)
    .innerJoin(clients, eq(debtRepayments.clientId, clients.id))
    .where(eq(clients.storeId, session.storeId))
    .orderBy(desc(debtRepayments.date));

  // Récupère les numéros de vente liés, si renseignés.
  const saleIds = Array.from(new Set(storeRows.map((r) => r.saleId).filter((id): id is string => !!id)));
  const saleNumeros = new Map<string, string>();
  if (saleIds.length > 0) {
    const saleRows = await db.query.sales.findMany({
      where: and(eq(sales.storeId, session.storeId)),
      columns: { id: true, numero: true },
    });
    for (const s of saleRows) {
      if (saleIds.includes(s.id)) saleNumeros.set(s.id, s.numero);
    }
  }

  return NextResponse.json({
    remboursements: storeRows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientNom: r.clientNom ?? "—",
      montant: n(r.montant),
      mode: r.mode,
      date: r.date.toISOString(),
      saleId: r.saleId,
      saleNumero: r.saleId ? saleNumeros.get(r.saleId) ?? null : null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "creances.edit")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clientId !== "string") {
    return NextResponse.json({ error: "Client requis" }, { status: 400 });
  }
  const montant = Number(body.montant);
  if (!Number.isFinite(montant) || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  const mode = typeof body.mode === "string" && ALLOWED_MODES.has(body.mode) ? body.mode : "ESPECES";

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, body.clientId), eq(clients.storeId, session.storeId)),
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  let saleId: string | null = null;
  if (typeof body.saleId === "string" && body.saleId) {
    const sale = await db.query.sales.findFirst({
      where: and(eq(sales.id, body.saleId), eq(sales.storeId, session.storeId), eq(sales.clientId, client.id)),
      columns: { id: true },
    });
    saleId = sale?.id ?? null;
  }

  const [created] = await db
    .insert(debtRepayments)
    .values({
      clientId: client.id,
      saleId,
      montant: String(montant),
      mode,
      date: body.date ? new Date(body.date) : new Date(),
    })
    .returning();

  return NextResponse.json(
    {
      remboursement: {
        id: created.id,
        clientId: created.clientId,
        clientNom: client.nom,
        montant: n(created.montant),
        mode: created.mode,
        date: created.date.toISOString(),
        saleId: created.saleId,
      },
    },
    { status: 201 }
  );
}
