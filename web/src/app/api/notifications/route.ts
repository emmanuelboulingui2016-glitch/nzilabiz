// Centre de notifications (la cloche de la barre du haut).
//
// Les alertes ne sont pas des événements stockés mais des ÉTATS recalculés à la demande : « 3
// produits sous le seuil », « 2 clients en retard de paiement ». Un état reste vrai tant que la
// situation n'est pas corrigée — le marquer « lu » n'aurait pas de sens, et une table
// d'événements à alimenter depuis chaque écran serait une source de désynchronisation.
//
// Les seuils viennent des réglages Paramètres > Notifications, et chaque type d'alerte peut y
// être désactivé.

import { NextResponse } from "next/server";
import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRequests, notificationSettings, products } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { chargerCreances } from "@/lib/creances/solde";

export type AlerteNiveau = "danger" | "warning" | "info";

export type Alerte = {
  id: string;
  niveau: AlerteNiveau;
  titre: string;
  detail: string;
  href: string;
};

const MAX_EXEMPLES = 3;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const reglages = await db.query.notificationSettings.findFirst({
    where: eq(notificationSettings.storeId, session.storeId),
  });

  const alertes: Alerte[] = [];

  // --- Stock bas ---------------------------------------------------------
  if ((reglages?.alerteStockBas ?? true) && (await peut(session, "stock.view"))) {
    const bas = await db
      .select({ id: products.id, nom: products.nom, quantiteStock: products.quantiteStock })
      .from(products)
      .where(
        and(
          eq(products.storeId, session.storeId),
          sql`${products.quantiteStock} <= ${products.seuilAlerte}`
        )
      )
      .orderBy(asc(products.quantiteStock))
      .limit(50);

    if (bas.length > 0) {
      alertes.push({
        id: "stock-bas",
        niveau: "warning",
        titre: `${bas.length} produit${bas.length > 1 ? "s" : ""} à réapprovisionner`,
        detail: bas
          .slice(0, MAX_EXEMPLES)
          .map((p) => `${p.nom} (${Number(p.quantiteStock)})`)
          .join(", "),
        href: "/stock",
      });
    }
  }

  // --- Péremption proche -------------------------------------------------
  if ((reglages?.alertePeremption ?? true) && (await peut(session, "stock.view"))) {
    const limite = new Date();
    limite.setDate(limite.getDate() + (reglages?.peremptionAlerteJours ?? 30));

    const bientot = await db
      .select({ id: products.id, nom: products.nom, datePeremption: products.datePeremption })
      .from(products)
      .where(
        and(
          eq(products.storeId, session.storeId),
          isNotNull(products.datePeremption),
          lte(products.datePeremption, limite)
        )
      )
      .orderBy(asc(products.datePeremption))
      .limit(50);

    if (bientot.length > 0) {
      alertes.push({
        id: "peremption",
        niveau: "danger",
        titre: `${bientot.length} produit${bientot.length > 1 ? "s" : ""} bientôt périmé${bientot.length > 1 ? "s" : ""}`,
        detail: bientot
          .slice(0, MAX_EXEMPLES)
          .map((p) => `${p.nom} — ${p.datePeremption?.toLocaleDateString("fr-FR")}`)
          .join(", "),
        href: "/stock",
      });
    }
  }

  // --- Créances en retard ------------------------------------------------
  if ((reglages?.alerteCreanceRetard ?? true) && (await peut(session, "creances.view"))) {
    const creances = await chargerCreances(session.storeId);
    const enRetard = creances.filter((c) => c.solde > 0 && (c.joursRetard ?? 0) > 0);

    if (enRetard.length > 0) {
      const total = enRetard.reduce((sum, c) => sum + c.solde, 0);
      alertes.push({
        id: "creances-retard",
        niveau: "danger",
        titre: `${enRetard.length} client${enRetard.length > 1 ? "s" : ""} en retard de paiement`,
        detail: `${Math.round(total).toLocaleString("fr-FR")} FCFA à recouvrer — ${enRetard
          .slice(0, MAX_EXEMPLES)
          .map((c) => `${c.nom} (${c.joursRetard} j)`)
          .join(", ")}`,
        href: "/creances",
      });
    }

    const depassements = creances.filter((c) => c.depassementLimite);
    if (depassements.length > 0) {
      alertes.push({
        id: "creances-limite",
        niveau: "warning",
        titre: `${depassements.length} client${depassements.length > 1 ? "s" : ""} au-dessus de sa limite de crédit`,
        detail: depassements.slice(0, MAX_EXEMPLES).map((c) => c.nom).join(", "),
        href: "/creances",
      });
    }
  }

  // --- Approbations en attente -------------------------------------------
  if (await peut(session, "approbations.decider")) {
    const attente = await db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.storeId, session.storeId),
          eq(approvalRequests.statut, "EN_ATTENTE")
        )
      )
      .limit(50);

    if (attente.length > 0) {
      alertes.push({
        id: "approbations",
        niveau: "info",
        titre: `${attente.length} demande${attente.length > 1 ? "s" : ""} d'approbation en attente`,
        detail: "Annulations de vente à valider ou refuser.",
        href: "/ventes",
      });
    }
  }

  return NextResponse.json({ alertes, total: alertes.length });
}
