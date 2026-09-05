/**
 * Lecture de la grille tarifaire en base — côté serveur uniquement.
 *
 * Séparé de `tarifs.ts` parce que ce dernier est importé par des composants client : un
 * `import { db }` partagé faisait entrer le pilote Postgres dans le paquet du navigateur, et la
 * compilation échouait sur `fs`, `net` et `tls`.
 */

import { cache } from "react";
import { db } from "@/db/client";
import { planTarifs } from "@/db/schema";
import { CYCLES, PLANS_TARIFES, TARIFS_DEFAUT, type Cycle, type Grille, type PlanTarife } from "./tarifs";

function estPlanTarife(v: string): v is PlanTarife {
  return (PLANS_TARIFES as readonly string[]).includes(v);
}

function estCycle(v: string): v is Cycle {
  return (CYCLES as readonly string[]).includes(v);
}

/**
 * Grille en vigueur : les lignes en base l'emportent, le code comble les manques.
 *
 * Mémorisée pour la durée de la requête — la page publique et l'écran Abonnement l'appellent
 * chacun une fois, et une page peut la demander depuis plusieurs composants.
 */
export const lireTarifs = cache(async (): Promise<Grille> => {
  const grille: Grille = {
    ESSENTIEL: { ...TARIFS_DEFAUT.ESSENTIEL },
    PREMIUM: { ...TARIFS_DEFAUT.PREMIUM },
    ENTREPRISE: { ...TARIFS_DEFAUT.ENTREPRISE },
  };

  try {
    for (const ligne of await db.select().from(planTarifs)) {
      if (!estPlanTarife(ligne.plan) || !estCycle(ligne.cycle)) continue;
      const montant = Number(ligne.montant);
      if (!Number.isFinite(montant) || montant < 0) continue;
      grille[ligne.plan][ligne.cycle] = montant;
    }
  } catch (e) {
    // Une grille illisible ne doit pas vider la page tarifs : on sert celle du code, en le disant.
    console.error("tarifs : grille illisible, repli sur les valeurs du code —", e instanceof Error ? e.message : e);
  }

  // Entreprise n'a plus de tarif public, quoi qu'il y ait en base — une ligne historique laissée
  // par l'ancien formulaire, un script de démonstration. On l'efface ici, à la source unique que
  // lisent la page tarifs et l'écran Abonnement, plutôt que de compter sur chaque écran pour ne
  // jamais l'afficher : c'est exactement le genre de champ qui resurgit un jour sans qu'on l'ait
  // touché. Le prix Entreprise vit désormais uniquement dans `stores.tarifNegocie*`, boutique par
  // boutique (voir `src/lib/paiements.ts`).
  grille.ENTREPRISE = {};

  return grille;
});
