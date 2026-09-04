"use client";

// Point d'entrée unique pour se déconnecter — utilisé par la barre latérale (app-shell.tsx) et par
// l'écran de blocage d'abonnement (bouton-deconnexion.tsx).
//
// Les deux chemins existaient déjà, mais un seul vidait vraiment les caches locaux. L'autre se
// contentait d'appeler l'API de déconnexion : sur un téléphone de boutique partagé entre vendeurs,
// le suivant retrouvait le HTML mis en cache par le service worker — /dashboard et son chiffre
// d'affaires compris — ainsi que le catalogue et les ventes de la base hors-ligne. Factoriser ici
// évite qu'un futur troisième bouton de déconnexion réintroduise le même trou en oubliant une
// étape.

import { compterVentesEnAttente, purgerDonneesLocales } from "@/lib/offline/db";

/** Préfixe des caches de pages, tenu en accord avec `public/sw.js`. */
const PREFIXE_CACHE_PAGES = "nzilabiz-pages-";

/**
 * Vide le cache HTML des pages mises de côté par le service worker pour le mode hors connexion.
 *
 * Le vidage se fait depuis la page, pas par un message au service worker : un `postMessage` sans
 * canal de retour n'attend rien, et si le service worker ne contrôle pas encore la page — juste
 * après une installation, par exemple — le message n'est jamais reçu, en silence. L'API Cache est
 * accessible depuis la page : autant s'en servir et savoir quand c'est fait.
 *
 * Seul le cache des pages est concerné. La coquille ne contient que des fichiers publics, et
 * l'effacer emporterait `/offline.html` — le filet de sécurité lui-même.
 *
 * L'échec n'est pas bloquant : on ne retient personne sur sa session parce qu'un cache refuse de
 * se vider.
 */
async function viderCachePages() {
  try {
    if (typeof caches === "undefined") return;
    const noms = await caches.keys();
    await Promise.all(noms.filter((n) => n.startsWith(PREFIXE_CACHE_PAGES)).map((n) => caches.delete(n)));
  } catch (e) {
    console.error("déconnexion : vidage du cache impossible —", e instanceof Error ? e.message : e);
  }
}

/** Message d'avertissement affiché quand des ventes n'ont pas encore atteint le serveur. */
function messageVentesEnAttente(nombre: number): string {
  const pluriel = nombre > 1;
  return (
    `${nombre} vente${pluriel ? "s" : ""} ${pluriel ? "ne sont" : "n'est"} pas encore envoyée${pluriel ? "s" : ""} ` +
    `au serveur. Reconnectez-vous à Internet avant de vous déconnecter, sinon ${
      pluriel ? "elles resteront" : "elle restera"
    } sur cet appareil.\n\nSe déconnecter quand même ?`
  );
}

/**
 * Déconnexion complète : session serveur, cache de pages du service worker, et données métier de
 * la base hors-ligne (catalogue, ventes) — dans cet ordre, chaque étape attendue avant de passer à
 * la suivante et avant toute navigation. Un vidage de cache non attendu par l'appelant peut être
 * interrompu à mi-chemin par le changement de page qui suit : c'est ce qui a fait échouer une
 * première tentative de correction sur ce projet.
 *
 * S'il reste des ventes encaissées hors connexion et jamais envoyées au serveur, l'utilisateur est
 * prévenu avant quoi que ce soit d'autre : c'est la seule copie qui en existe, la détruire
 * détruirait de l'argent réellement encaissé. Il peut annuler et rester connecté le temps de
 * retrouver le réseau, ou accepter le risque et se déconnecter quand même — dans ce cas, la file
 * d'attente et les ventes locales ne sont volontairement pas touchées (voir `purgerDonneesLocales`
 * dans `lib/offline/db.ts`), seuls le catalogue et les caches de pages le sont.
 *
 * @param storeId boutique de la session en cours, quand l'appelant la connaît (`app-shell.tsx` l'a
 * via `boutiqueActiveId`, reçu du calque serveur). Sert uniquement à affiner le décompte de ventes
 * en attente à celles de cette boutique — sans lui, le décompte porte sur l'appareil entier, tous
 * comptes confondus, ce qui reste sûr (jamais sous-estimé) mais peut avertir à tort pour des ventes
 * d'une autre boutique déjà présente sur le même appareil.
 * @returns `false` si l'utilisateur a annulé après l'avertissement — il reste connecté. `true` si
 * la déconnexion a eu lieu.
 */
export async function deconnecterCompletement(storeId?: string): Promise<boolean> {
  const enAttente = await compterVentesEnAttente(storeId);
  if (enAttente > 0 && typeof window !== "undefined") {
    const continuer = window.confirm(messageVentesEnAttente(enAttente));
    if (!continuer) return false;
  }

  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Le cookie n'a peut-être pas pu être effacé côté serveur : on vide quand même ce qui est sous
    // notre contrôle plutôt que de laisser les données du compte accessibles sur l'appareil.
  }

  await viderCachePages();
  await purgerDonneesLocales();

  return true;
}
