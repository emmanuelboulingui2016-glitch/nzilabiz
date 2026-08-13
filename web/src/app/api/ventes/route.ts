// GET /api/ventes — historique des ventes (§7 du cahier des charges).
// Filtres : période (from/to), mode de paiement, recherche article. Scoping strict par storeId,
// et par ventes.view.own (Vendeur ne voit que ses propres ventes) vs ventes.view.all (Patron/Gérant).

import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { sales } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const canViewAll = can(session.role, "ventes.view.all");
  const canViewOwn = can(session.role, "ventes.view.own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const paiement = searchParams.get("paiement");
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const conditions: SQL[] = [eq(sales.storeId, session.storeId)];
  if (!canViewAll) conditions.push(eq(sales.userId, session.userId));
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) conditions.push(gte(sales.dateHeure, fromDate));
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) conditions.push(lte(sales.dateHeure, toDate));
  }

  const rows = await db.query.sales.findMany({
    where: and(...conditions),
    orderBy: desc(sales.dateHeure),
    with: {
      items: { with: { product: true } },
      payments: true,
      client: true,
      user: true,
    },
  });

  const filtered = rows.filter((sale) => {
    if (paiement && !sale.payments.some((p) => p.mode === paiement)) return false;
    if (q && !sale.items.some((it) => (it.product?.nom ?? "").toLowerCase().includes(q))) return false;
    return true;
  });

  const result = filtered.map((sale) => ({
    id: sale.id,
    numero: sale.numero,
    dateHeure: sale.dateHeure,
    statut: sale.statut,
    motifAnnulation: sale.motifAnnulation,
    total: sale.total,
    qte: sale.items.reduce((sum, it) => sum + Number(it.quantite), 0),
    itemsCount: sale.items.length,
    premierArticle: sale.items[0]?.product?.nom ?? "—",
    clientNom: sale.client?.nom ?? null,
    vendeurNom: sale.user?.nom ?? null,
    paiements: sale.payments.map((p) => p.mode),
    items: sale.items.map((it) => ({
      id: it.id,
      productNom: it.product?.nom ?? "—",
      quantite: it.quantite,
      prixUnitaire: it.prixUnitaire,
      sousTotal: it.sousTotal,
    })),
    payments: sale.payments.map((p) => ({
      mode: p.mode,
      montant: p.montant,
      montantRecu: p.montantRecu,
      monnaieRendue: p.monnaieRendue,
    })),
  }));

  // KPIs du jour — indépendants des filtres actifs (§7 : "CA aujourd'hui, Transactions, Ventes à crédit"),
  // mais respectent le même périmètre de visibilité (own vs all).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayConditions: SQL[] = [
    eq(sales.storeId, session.storeId),
    gte(sales.dateHeure, startOfDay),
    lte(sales.dateHeure, endOfDay),
  ];
  if (!canViewAll) todayConditions.push(eq(sales.userId, session.userId));

  const todaySales = await db.query.sales.findMany({
    where: and(...todayConditions),
    with: { payments: true },
  });
  const validToday = todaySales.filter((s) => s.statut === "VALIDEE");
  const caAujourdhui = validToday.reduce((sum, s) => sum + Number(s.total), 0);
  const transactions = validToday.length;
  const creditSalesToday = validToday.filter((s) => s.payments.some((p) => p.mode === "CREDIT"));

  return NextResponse.json({
    kpis: {
      caAujourdhui,
      transactions,
      ventesCredit: {
        count: creditSalesToday.length,
        montant: creditSalesToday.reduce((sum, s) => sum + Number(s.total), 0),
      },
    },
    sales: result,
  });
}
