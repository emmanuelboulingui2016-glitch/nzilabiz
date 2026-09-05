/**
 * Circuit de paiement de l'abonnement — émission d'une demande, confirmation, prolongation.
 *
 * Contexte : la formule Entreprise n'a plus de prix public (voir `tarifs.ts`/`tarifs-serveur.ts`).
 * Le propriétaire de la plateforme négocie un tarif de vive voix avec chaque commerçant, le fixe
 * depuis la fiche de la boutique (`stores.tarifNegocie*`), ce qui émet une demande de paiement
 * (`payment_requests`, statut `EN_ATTENTE`). Aucun agrégateur Mobile Money n'est encore branché
 * (PayDunya / CinetPay / Flutterwave — choix non arrêté) : en attendant, le propriétaire encaisse
 * par ses propres moyens et confirme lui-même le paiement reçu.
 *
 * **Un seul chemin prolonge un abonnement : `confirmerPaiement`.** Que la confirmation vienne d'un
 * clic dans l'administration aujourd'hui ou d'un webhook d'agrégateur demain, elle passe par cette
 * fonction, avec `source` qui change et rien d'autre. La tentation, le jour où l'agrégateur sera
 * branché, sera d'écrire la prolongation une seconde fois dans le webhook parce que c'est plus
 * rapide que d'importer cette fonction — il ne faut pas céder : les deux chemins finiraient par
 * diverger (arrondi différent, oubli d'un cas limite), et un commerçant qui a payé se retrouverait
 * bloqué sans que personne ne comprenne pourquoi en relisant seulement l'un des deux chemins.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { paymentRequests, stores } from "@/db/schema";
import { calculerPeriode, type Cycle, type PlanTarife } from "@/lib/tarifs";

export type DemandePaiement = typeof paymentRequests.$inferSelect;

/**
 * Émet une demande de paiement pour une boutique, à partir d'un tarif déjà fixé.
 *
 * La période couverte est calculée depuis l'échéance d'abonnement en cours de la boutique (voir
 * `calculerPeriode`) : elle prolonge l'abonnement s'il est encore valide, ou repart d'aujourd'hui
 * s'il est expiré ou absent — jamais calculée à la confirmation, pour qu'une confirmation tardive
 * (le propriétaire encaisse trois jours après avoir fixé le prix) ne change pas la date de fin
 * annoncée au commerçant au moment de l'émission.
 *
 * Toute demande `EN_ATTENTE` déjà ouverte pour cette boutique est annulée avant d'en émettre une
 * nouvelle : sans cela, fixer un nouveau tarif avant confirmation du précédent laisserait deux
 * demandes actives se chevaucher, et la confirmation de la mauvaise prolongerait l'abonnement sur
 * la mauvaise période.
 */
export async function emettreDemandePaiement(params: {
  storeId: string;
  plan: PlanTarife;
  cycle: Cycle;
  montant: number;
  devise: string;
  abonnementExpireLe: Date | null;
  emiseParId: string;
  maintenant?: Date;
}): Promise<DemandePaiement> {
  const maintenant = params.maintenant ?? new Date();

  // Séquentiel, jamais en parallèle (pooler Supavisor en mode transaction) : on annule d'abord,
  // on insère ensuite.
  await db
    .update(paymentRequests)
    .set({ statut: "ANNULEE", annuleeLe: maintenant })
    .where(and(eq(paymentRequests.storeId, params.storeId), eq(paymentRequests.statut, "EN_ATTENTE")));

  const { debut, fin } = calculerPeriode(params.cycle, params.abonnementExpireLe, maintenant);

  const [demande] = await db
    .insert(paymentRequests)
    .values({
      storeId: params.storeId,
      plan: params.plan,
      cycle: params.cycle,
      montant: String(params.montant),
      devise: params.devise,
      periodeDebut: debut,
      periodeFin: fin,
      emiseParId: params.emiseParId,
    })
    .returning();

  return demande;
}

export type SourceConfirmation = "MANUELLE" | "AGREGATEUR";

export type ResultatConfirmation =
  | { statut: "CONFIRMEE"; demande: DemandePaiement }
  | { statut: "DEJA_CONFIRMEE"; demande: DemandePaiement }
  | { statut: "INTROUVABLE" }
  | { statut: "NON_CONFIRMABLE"; demande: DemandePaiement }
  | { statut: "REFERENCE_DEJA_UTILISEE" };

/**
 * Confirme une demande de paiement et prolonge l'abonnement de la boutique en conséquence.
 *
 * **Idempotence** : l'UPDATE ne porte que sur les lignes encore `EN_ATTENTE`
 * (`where(... , eq(statut, "EN_ATTENTE"))`), en une seule instruction. PostgreSQL verrouille la
 * ligne le temps de l'écriture : deux confirmations concurrentes de la même demande — un clic
 * manuel et un rappel d'agrégateur, ou deux rappels du même agrégateur qui rejoue son webhook — ne
 * peuvent faire avancer le statut qu'une seule fois. La seconde ne trouve plus de ligne
 * `EN_ATTENTE`, ne touche donc jamais `stores.abonnement_expire_le`, et le sait
 * (`DEJA_CONFIRMEE` plutôt qu'une erreur silencieuse).
 *
 * L'index unique partiel `(agregateur_fournisseur, agregateur_reference)` protège en plus contre
 * une même référence de transaction utilisée sur deux demandes différentes ; l'erreur Postgres
 * (23505) est traduite en résultat exploitable plutôt que de remonter telle quelle.
 */
export async function confirmerPaiement(params: {
  demandeId: string;
  source: SourceConfirmation;
  confirmeeParId?: string | null;
  agregateurFournisseur?: string | null;
  agregateurReference?: string | null;
  maintenant?: Date;
}): Promise<ResultatConfirmation> {
  const confirmeeParId = params.confirmeeParId ?? null;
  const agregateurFournisseur = params.agregateurFournisseur ?? null;
  const agregateurReference = params.agregateurReference ?? null;
  const maintenant = params.maintenant ?? new Date();

  let misAJour: DemandePaiement | undefined;
  try {
    [misAJour] = await db
      .update(paymentRequests)
      .set({
        statut: "PAYEE",
        confirmeeLe: maintenant,
        confirmeeSource: params.source,
        confirmeeParId,
        agregateurFournisseur,
        agregateurReference,
      })
      .where(and(eq(paymentRequests.id, params.demandeId), eq(paymentRequests.statut, "EN_ATTENTE")))
      .returning();
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "23505") return { statut: "REFERENCE_DEJA_UTILISEE" };
    throw e;
  }

  if (misAJour) {
    // La prolongation vit ici, et nulle part ailleurs (voir le commentaire en tête de fichier).
    // Séquentiel : deuxième requête après celle du dessus, jamais en parallèle avec elle.
    await db
      .update(stores)
      .set({ plan: misAJour.plan, abonnementExpireLe: misAJour.periodeFin })
      .where(eq(stores.id, misAJour.storeId));

    return { statut: "CONFIRMEE", demande: misAJour };
  }

  // Rien mis à jour : la demande n'existe pas, ou elle n'est plus EN_ATTENTE. On distingue les
  // deux cas pour un message exploitable côté appelant (administration ou futur webhook).
  const existante = await db.query.paymentRequests.findFirst({ where: eq(paymentRequests.id, params.demandeId) });
  if (!existante) return { statut: "INTROUVABLE" };
  if (existante.statut === "PAYEE") return { statut: "DEJA_CONFIRMEE", demande: existante };
  return { statut: "NON_CONFIRMABLE", demande: existante };
}
