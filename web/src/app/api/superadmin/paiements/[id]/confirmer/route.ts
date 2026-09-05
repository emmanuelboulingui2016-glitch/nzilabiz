// Superadmin — confirmation manuelle d'une demande de paiement.
//
// N'implémente aucune logique de prolongation ici : tout passe par `confirmerPaiement`
// (src/lib/paiements.ts), le seul chemin qui écrit `stores.abonnement_expire_le`. Le jour où un
// agrégateur Mobile Money sera branché, son webhook appellera la même fonction avec
// `source: "AGREGATEUR"` — jamais une prolongation réimplémentée ici à côté, qui finirait par
// diverger.

import { NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/auth/superadmin";
import { confirmerPaiement } from "@/lib/paiements";

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isNaN(x) ? 0 : x;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  const resultat = await confirmerPaiement({
    demandeId: id,
    source: "MANUELLE",
    confirmeeParId: session.userId,
  });

  switch (resultat.statut) {
    case "INTROUVABLE":
      return NextResponse.json({ error: "Demande de paiement introuvable." }, { status: 404 });

    case "NON_CONFIRMABLE":
      return NextResponse.json(
        {
          error:
            resultat.demande.statut === "ANNULEE"
              ? "Cette demande a été annulée (un tarif plus récent a été fixé entre-temps), elle ne peut plus être confirmée."
              : "Cette demande a expiré, elle ne peut plus être confirmée.",
          code: "DEMANDE_NON_CONFIRMABLE",
        },
        { status: 409 }
      );

    case "REFERENCE_DEJA_UTILISEE":
      // N'arrive normalement jamais sur une confirmation manuelle (elle ne fournit pas de
      // référence d'agrégateur) — gardé pour que la fonction partagée reste correcte dans tous
      // les cas d'appel, y compris le futur webhook.
      return NextResponse.json({ error: "Référence de paiement déjà utilisée." }, { status: 409 });

    case "DEJA_CONFIRMEE":
    case "CONFIRMEE": {
      const d = resultat.demande;
      return NextResponse.json({
        ok: true,
        dejaConfirmee: resultat.statut === "DEJA_CONFIRMEE",
        demande: {
          id: d.id,
          statut: d.statut,
          montant: n(d.montant),
          devise: d.devise,
          periodeFin: d.periodeFin.toISOString(),
          confirmeeLe: d.confirmeeLe?.toISOString() ?? null,
        },
      });
    }
  }
}
