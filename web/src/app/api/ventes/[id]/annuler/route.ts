// POST /api/ventes/[id]/annuler — annulation d'une vente (§7 : motif obligatoire + workflow
// d'approbation). Patron (ventes.annuler.direct) : annulation immédiate + réajustement stock.
// Gérant/Vendeur (ventes.annuler.demander) : crée une ApprovalRequest en attente de validation.

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRequests, products, sales, stockMovements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { bloquerSiExpiree } from "@/lib/abonnement";

const MOTIF_LABELS: Record<string, string> = {
  erreur_saisie: "Erreur de saisie",
  retour_client: "Retour client",
  geste_commercial: "Geste commercial",
  autre: "Autre",
};

function buildMotif(motifType: unknown, motifTexte: unknown): string | null {
  if (typeof motifType !== "string") return null;
  const label = MOTIF_LABELS[motifType];
  if (!label) return null;
  const texte = typeof motifTexte === "string" ? motifTexte.trim() : "";
  if (motifType === "autre") {
    return texte ? `Autre : ${texte}` : null;
  }
  return texte ? `${label} — ${texte}` : label;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const motif = buildMotif(body?.motifType, body?.motifTexte);
  if (!motif) {
    return NextResponse.json({ error: "Le motif d'annulation est obligatoire." }, { status: 400 });
  }

  const sale = await db.query.sales.findFirst({
    where: and(eq(sales.id, id), eq(sales.storeId, session.storeId)),
    with: { items: true },
  });
  if (!sale) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  if (sale.statut === "ANNULEE") {
    return NextResponse.json({ error: "Cette vente est déjà annulée." }, { status: 400 });
  }

  const canDirect = can(session.role, "ventes.annuler.direct");
  const canDemander = can(session.role, "ventes.annuler.demander");
  if (!canDirect && !canDemander) {
    return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  }
  // Un Vendeur ne peut demander l'annulation que de ses propres ventes.
  if (session.role === "VENDEUR" && sale.userId !== session.userId) {
    return NextResponse.json({ error: "Vous ne pouvez agir que sur vos propres ventes." }, { status: 403 });
  }

  if (canDirect) {
    await db.transaction(async (tx) => {
      await tx
        .update(sales)
        .set({
          statut: "ANNULEE",
          motifAnnulation: motif,
          annuleLe: new Date(),
          approuveParId: session.userId,
        })
        .where(eq(sales.id, sale.id));

      for (const item of sale.items) {
        await tx
          .update(products)
          .set({
            quantiteStock: sql`${products.quantiteStock} + ${item.quantite}`,
            misAJourLe: new Date(),
          })
          .where(eq(products.id, item.productId));

        await tx.insert(stockMovements).values({
          productId: item.productId,
          type: "ANNULATION",
          quantite: item.quantite,
          motif,
          userId: session.userId,
          saleId: sale.id,
        });
      }
    });

    return NextResponse.json({ ok: true, mode: "annulee" as const });
  }

  // canDemander uniquement : la vente reste VALIDEE, une demande d'approbation est créée.
  const existing = await db.query.approvalRequests.findFirst({
    where: and(
      eq(approvalRequests.storeId, session.storeId),
      eq(approvalRequests.refType, "sale"),
      eq(approvalRequests.refId, sale.id),
      eq(approvalRequests.statut, "EN_ATTENTE")
    ),
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      mode: "demande" as const,
      message: "Une demande d'annulation est déjà en attente de validation pour cette vente.",
    });
  }

  await db.insert(approvalRequests).values({
    storeId: session.storeId,
    type: "ANNULATION_VENTE",
    refType: "sale",
    refId: sale.id,
    motif,
    demandeParId: session.userId,
    statut: "EN_ATTENTE",
  });

  return NextResponse.json({
    ok: true,
    mode: "demande" as const,
    message: "Demande envoyée, en attente de validation.",
  });
}
