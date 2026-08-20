// Chargement de l'historique des ventes — source unique, partagée par la page serveur et par
// GET /api/ventes.
//
// Deux corrections par rapport à la version précédente.
//
// Les colonnes des relations sont énumérées. `with: { product: true }` ramenait la ligne produit
// entière pour chaque article de chaque vente — or les photos sont stockées en base64 dans la base :
// l'écran rapatriait donc une image complète par ligne de vente, uniquement pour afficher un nom.
// Sur l'historique complet d'une boutique, cela se compte en mégaoctets.
//
// Et la page rend désormais la liste déjà remplie, au lieu d'une coquille que le navigateur devait
// re-remplir aussitôt — un aller-retour de moins, soit environ 330 ms depuis une connexion
// gabonaise.

import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { sales } from "@/db/schema";

export type FiltresVentes = {
  from?: string | null;
  to?: string | null;
  paiement?: string | null;
  q?: string | null;
};

export type PerimetreVentes = {
  storeId: string;
  userId: string;
  /** Un vendeur ne voit que ses propres ventes ; patron et gérant voient toute la boutique. */
  canViewAll: boolean;
};

export async function chargerVentes(p: PerimetreVentes, filtres: FiltresVentes = {}) {
  const q = (filtres.q ?? "").trim().toLowerCase();
  const paiement = filtres.paiement ?? "";

  const conditions: SQL[] = [eq(sales.storeId, p.storeId)];
  if (!p.canViewAll) conditions.push(eq(sales.userId, p.userId));
  if (filtres.from) {
    const d = new Date(filtres.from);
    if (!Number.isNaN(d.getTime())) conditions.push(gte(sales.dateHeure, d));
  }
  if (filtres.to) {
    const d = new Date(filtres.to);
    if (!Number.isNaN(d.getTime())) conditions.push(lte(sales.dateHeure, d));
  }

  const rows = await db.query.sales.findMany({
    where: and(...conditions),
    orderBy: desc(sales.dateHeure),
    with: {
      items: { with: { product: { columns: { nom: true } } } },
      payments: true,
      client: { columns: { nom: true } },
      user: { columns: { nom: true } },
    },
  });

  const filtered = rows.filter((sale) => {
    if (paiement && !sale.payments.some((x) => x.mode === paiement)) return false;
    if (q && !sale.items.some((it) => (it.product?.nom ?? "").toLowerCase().includes(q))) return false;
    return true;
  });

  const result = filtered.map((sale) => ({
    id: sale.id,
    numero: sale.numero,
    // Sérialisée explicitement : la route API la convertissait implicitement en passant par
    // JSON, le rendu serveur non. Les deux chemins doivent produire la même forme.
    dateHeure: sale.dateHeure.toISOString(),
    statut: sale.statut,
    motifAnnulation: sale.motifAnnulation,
    total: sale.total,
    qte: sale.items.reduce((sum, it) => sum + Number(it.quantite), 0),
    itemsCount: sale.items.length,
    premierArticle: sale.items[0]?.product?.nom ?? "—",
    clientNom: sale.client?.nom ?? null,
    vendeurNom: sale.user?.nom ?? null,
    paiements: sale.payments.map((x) => x.mode),
    items: sale.items.map((it) => ({
      id: it.id,
      productNom: it.product?.nom ?? "—",
      quantite: it.quantite,
      prixUnitaire: it.prixUnitaire,
      sousTotal: it.sousTotal,
    })),
    payments: sale.payments.map((x) => ({
      mode: x.mode,
      montant: x.montant,
      montantRecu: x.montantRecu,
      monnaieRendue: x.monnaieRendue,
    })),
  }));

  // Indicateurs du jour — indépendants des filtres actifs (§7 : « CA aujourd'hui, Transactions,
  // Ventes à crédit »), mais soumis au même périmètre de visibilité.
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date();
  finJour.setHours(23, 59, 59, 999);

  const conditionsJour: SQL[] = [
    eq(sales.storeId, p.storeId),
    gte(sales.dateHeure, debutJour),
    lte(sales.dateHeure, finJour),
  ];
  if (!p.canViewAll) conditionsJour.push(eq(sales.userId, p.userId));

  const ventesDuJour = await db.query.sales.findMany({
    where: and(...conditionsJour),
    columns: { total: true, statut: true },
    with: { payments: { columns: { mode: true } } },
  });

  const valides = ventesDuJour.filter((s) => s.statut === "VALIDEE");
  const aCredit = valides.filter((s) => s.payments.some((x) => x.mode === "CREDIT"));

  return {
    kpis: {
      caAujourdhui: valides.reduce((sum, s) => sum + Number(s.total), 0),
      transactions: valides.length,
      ventesCredit: {
        count: aCredit.length,
        montant: aCredit.reduce((sum, s) => sum + Number(s.total), 0),
      },
    },
    sales: result,
  };
}

export type DonneesVentes = Awaited<ReturnType<typeof chargerVentes>>;
