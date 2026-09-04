// Limitation de débit des endpoints sensibles (connexion, inscription, invitations, support,
// suppression de compte).
//
// Les compteurs vivent en base, pas en mémoire du processus. Sur un hébergement sans serveur —
// Vercel, où l'application est déployée — chaque requête peut atterrir sur une instance neuve
// avec sa propre mémoire : un compteur local autoriserait autant de tentatives qu'il existe
// d'instances, c'est-à-dire une protection décorative sur la page de connexion. La table
// `rate_limits` est partagée par toutes les instances.
//
// Fenêtre fixe plutôt que glissante : un seul aller-retour SQL atomique, là où une fenêtre
// glissante demanderait de stocker et relire chaque horodatage. Le prix à payer est une tolérance
// au changement de fenêtre (jusqu'à 2×limite à cheval sur deux fenêtres), sans conséquence pour
// des seuils qui se comptent en unités par heure.

import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type RateLimitResult = {
  ok: boolean;
  /** Secondes à attendre avant une nouvelle tentative (0 si autorisé). */
  retryAfter: number;
  restant: number;
};

type Ligne = { compteur: number; bloque_jusqua: Date | null };

export async function rateLimit(
  key: string,
  { limite, fenetreMs, blocageMs = fenetreMs }: { limite: number; fenetreMs: number; blocageMs?: number }
): Promise<RateLimitResult> {
  const fenetre = `${Math.ceil(fenetreMs / 1000)} seconds`;
  const blocage = `${Math.ceil(blocageMs / 1000)} seconds`;

  try {
    // Une seule instruction, donc atomique : deux requêtes simultanées ne peuvent pas lire le même
    // compteur et l'incrémenter chacune de son côté. Trois cas, dans cet ordre :
    //   1. déjà bloqué  → on ne touche à rien, le blocage court jusqu'à son terme ;
    //   2. fenêtre expirée → on repart à 1 sur une fenêtre neuve ;
    //   3. sinon        → incrément, et blocage si le seuil est franchi.
    const lignes = await db.execute<Ligne>(sql`
      insert into rate_limits as r (cle, fenetre_debut, compteur, bloque_jusqua)
      values (${key}, now(), 1, null)
      on conflict (cle) do update set
        fenetre_debut = case
          when r.bloque_jusqua is not null and r.bloque_jusqua > now() then r.fenetre_debut
          when r.fenetre_debut + ${fenetre}::interval <= now() then now()
          else r.fenetre_debut
        end,
        compteur = case
          when r.bloque_jusqua is not null and r.bloque_jusqua > now() then r.compteur
          when r.fenetre_debut + ${fenetre}::interval <= now() then 1
          else r.compteur + 1
        end,
        bloque_jusqua = case
          when r.bloque_jusqua is not null and r.bloque_jusqua > now() then r.bloque_jusqua
          when r.fenetre_debut + ${fenetre}::interval <= now() then null
          when r.compteur + 1 > ${limite} then now() + ${blocage}::interval
          else null
        end
      returning compteur, bloque_jusqua
    `);

    // La purge est accessoire : son échec ne doit pas faire échouer la requête en cours. Il doit en
    // revanche laisser une trace. Avalée en silence, elle pouvait échouer à chaque fois sans que
    // rien ne le signale — et la table grossir jusqu'à ralentir la limitation de débit elle-même,
    // c'est-à-dire la protection des écrans de connexion.
    if (Math.random() < 0.002) {
      await purgerRateLimits().catch((e) =>
        console.error("rate-limit : purge impossible —", e instanceof Error ? e.message : e)
      );
    }

    const ligne = (lignes as unknown as Ligne[])[0];
    if (!ligne) return { ok: true, retryAfter: 0, restant: limite - 1 };

    const bloqueJusqua = ligne.bloque_jusqua ? new Date(ligne.bloque_jusqua).getTime() : 0;
    const maintenant = Date.now();
    if (bloqueJusqua > maintenant) {
      return { ok: false, retryAfter: Math.ceil((bloqueJusqua - maintenant) / 1000), restant: 0 };
    }

    const compteur = Number(ligne.compteur);
    if (compteur > limite) {
      return { ok: false, retryAfter: Math.ceil(blocageMs / 1000), restant: 0 };
    }
    return { ok: true, retryAfter: 0, restant: Math.max(0, limite - compteur) };
  } catch (erreur) {
    // Base injoignable : on laisse passer. Refuser bloquerait tout le monde sur un incident de
    // base, alors que les routes protégées ont de toute façon besoin de la base pour aboutir —
    // un attaquant ne gagne donc rien à provoquer cette situation.
    console.error("rate-limit : compteur indisponible, requête laissée passer —", erreur);
    return { ok: true, retryAfter: 0, restant: limite };
  }
}

/**
 * Remet un compteur à zéro — appelé après une authentification réussie pour qu'un utilisateur
 * légitime qui s'est trompé deux fois ne traîne pas son quota.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.execute(sql`delete from rate_limits where cle = ${key}`);
  } catch (erreur) {
    console.error("rate-limit : remise à zéro impossible —", erreur);
  }
}

/**
 * Supprime les compteurs dont la fenêtre et le blocage sont expirés depuis plus d'un jour. Sans
 * cela la table grossit indéfiniment sous attaque distribuée, chaque adresse laissant sa ligne.
 *
 * Déclenché au hasard depuis `rateLimit`, environ une fois sur cinq cents : pas de tâche planifiée
 * à configurer ni de route de maintenance à protéger, et le surcoût — quelques dizaines de
 * millisecondes sur une requête de connexion sur cinq cents — est sans effet perceptible.
 */
export async function purgerRateLimits(): Promise<void> {
  await db.execute(sql`
    delete from rate_limits
    where fenetre_debut < now() - interval '1 day'
      and (bloque_jusqua is null or bloque_jusqua < now())
  `);
}

// Adresse de l'appelant — alimente toutes les clés de limitation par IP (connexion, inscription,
// invitations, etc.), donc doit résister à la falsification : un client qui pose lui-même
// `X-Forwarded-For` ne doit pas pouvoir se présenter sous une IP différente à chaque requête pour
// contourner un compteur.
//
// Sur Vercel, `x-vercel-forwarded-for` est posé par l'edge de la plateforme et écrase toute valeur
// envoyée par le client : c'est la seule source fiable en production, on la préfère donc. À
// défaut, `x-real-ip` est également posé par la plateforme (reverse proxy devant l'application).
//
// `x-forwarded-for` ne sert qu'en dernier repli, pour le développement local sans Vercel devant —
// et dans ce cas on prend le DERNIER maillon de la chaîne, pas le premier : chaque proxy traversé
// ajoute son entrée à la suite de celles qui existent déjà, donc le premier maillon est celui posé
// par le client lui-même (entièrement sous son contrôle) tandis que le dernier est ajouté par le
// proxy le plus proche du serveur, le seul que le client ne peut pas falsifier.
export function clientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const maillons = forwarded.split(",").map((m) => m.trim()).filter(Boolean);
    if (maillons.length) return maillons[maillons.length - 1];
  }

  return "inconnu";
}

export function tooManyRequests(retryAfter: number, message: string) {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
