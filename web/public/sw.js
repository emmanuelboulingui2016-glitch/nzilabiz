// NzilaBiz — service worker minimal, écrit à la main.
//
// 🔧 Écart documenté (voir README « Écarts vs cahier des charges ») : le plugin `next-pwa`
// s'appuie sur une configuration Webpack (workbox-webpack-plugin). Next.js 16 utilise Turbopack
// par défaut pour `next build`, et un `build` avec configuration Webpack personnalisée échoue
// volontairement pour éviter les erreurs silencieuses. Plutôt que de forcer `--webpack` (perdant
// les gains de Turbopack) nous avons écrit ce service worker à la main.
//
// ---------------------------------------------------------------------------------------------
// Ce que la version précédente faisait, et pourquoi elle ne pouvait pas marcher
// ---------------------------------------------------------------------------------------------
// Elle déposait six fichiers au moment de l'installation — manifeste, favicon, icônes, page
// hors-ligne — puis **n'écrivait plus jamais dans le cache**. Ses deux branches de repli
// interrogeaient donc un cache qu'elles savaient vide :
//
//     fetch(request).catch(() => caches.match(request) || caches.match("/offline.html"))
//     caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
//
// `caches.match("/dashboard")` n'a jamais rien trouvé, et la dernière ligne renvoyait `cached`,
// une variable dont on savait déjà qu'elle valait `undefined`. Résultat : un vendeur qui fermait
// l'application et la rouvrait sans réseau tombait invariablement sur « Vous êtes hors
// connexion », alors même que ses ventes étaient dans IndexedDB, à portée de main mais
// inaccessibles — l'application ne pouvait pas démarrer pour aller les chercher.
//
// Le mode hors connexion est le principal argument de vente de cette application en Afrique
// centrale. Il repose donc, maintenant, sur un cache qu'on alimente.
//
// ---------------------------------------------------------------------------------------------
// Versions de cache
// ---------------------------------------------------------------------------------------------
// Changer le nom est le seul moyen de forcer le renouvellement : l'activation supprime tout cache
// portant un autre nom. C'est ce qui avait servi à corriger le favicon resté celui du gabarit.
//
// v2 : correction du favicon (le gabarit Next.js en imposait un autre) et petites tailles.
// v3 : le cache est enfin alimenté — pages et ressources statiques.
const VERSION = "v3";
const CACHE_COQUILLE = `nzilabiz-shell-${VERSION}`;
const CACHE_PAGES = `nzilabiz-pages-${VERSION}`;
const CACHES_CONNUS = [CACHE_COQUILLE, CACHE_PAGES];

const APP_SHELL = [
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-32.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
];

// Une vingtaine de pages suffit à couvrir ce qu'un commerçant ouvre dans une journée. Sans borne,
// le cache grossit indéfiniment sur un téléphone qui a déjà peu de place — et c'est justement sur
// ces téléphones-là que l'application doit tenir.
const MAX_PAGES = 20;

// Dernière page d'application servie : c'est elle qu'on présente si l'utilisateur rouvre
// l'application hors connexion sur une adresse qu'il n'avait jamais visitée.
const CLE_DERNIERE_PAGE = "/__derniere-page";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_COQUILLE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CACHES_CONNUS.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Supprime les entrées les plus anciennes au-delà de la limite. */
async function bornerCache(nom, maximum) {
  const cache = await caches.open(nom);
  const cles = await cache.keys();
  for (let i = 0; i < cles.length - maximum; i++) await cache.delete(cles[i]);
}

/**
 * Une charge RSC n'est pas une page : c'est le format interne par lequel Next.js transporte le
 * résultat d'un rendu serveur lors d'une navigation côté client. La mettre en cache mêlerait des
 * fragments d'une version du site à ceux d'une autre. On la laisse passer : quand elle échoue
 * hors connexion, le navigateur retombe sur une navigation complète — et celle-là trouvera la
 * page en cache.
 */
function estChargeRsc(request) {
  const url = new URL(request.url);
  return url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
}

function cacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Une autre origine, une route d'API, une charge RSC : rien de tout cela n'entre dans le cache.
  // Les données métier passent par IndexedDB, pas par le service worker — mettre en cache une
  // réponse d'API reviendrait à servir au commerçant un stock ou un chiffre d'affaires périmés
  // sans qu'il puisse s'en apercevoir.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (estChargeRsc(request)) return;

  // ---------------------------------------------------------------------------------------------
  // Navigation : réseau d'abord, et on garde une copie.
  // ---------------------------------------------------------------------------------------------
  // Réseau d'abord parce qu'un commerçant connecté doit toujours voir ses chiffres du jour, jamais
  // ceux d'hier. Le cache n'est qu'un filet, et il ne se déploie que lorsque le réseau a échoué.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable(response)) {
            const copie = response.clone();
            event.waitUntil(
              caches.open(CACHE_PAGES).then(async (cache) => {
                await cache.put(request, copie.clone());
                await cache.put(CLE_DERNIERE_PAGE, copie);
                await bornerCache(CACHE_PAGES, MAX_PAGES);
              })
            );
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_PAGES);
          // La page demandée, sinon la dernière page connue de l'application, sinon l'écran
          // d'excuse. Servir « une » page de l'application vaut mieux qu'un cul-de-sac : le
          // vendeur peut de là rejoindre la caisse, qui lit ses ventes dans IndexedDB.
          return (
            (await cache.match(request)) ||
            (await cache.match(CLE_DERNIERE_PAGE)) ||
            (await caches.match("/offline.html"))
          );
        })
    );
    return;
  }

  // ---------------------------------------------------------------------------------------------
  // Ressources statiques : cache d'abord, et on alimente le cache.
  // ---------------------------------------------------------------------------------------------
  // Les fichiers de `/_next/static` portent une empreinte dans leur nom : ils sont immuables, les
  // garder ne risque pas de servir une version périmée. C'est ce qui permet à l'application de
  // démarrer sans réseau — sans son JavaScript, une page en cache n'est qu'un décor.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (cacheable(response)) {
            const copie = response.clone();
            event.waitUntil(caches.open(CACHE_COQUILLE).then((cache) => cache.put(request, copie)));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

// ---------------------------------------------------------------------------------------------
// Vidage à la déconnexion
// ---------------------------------------------------------------------------------------------
// Le cache des pages contient désormais le HTML de `/dashboard`, chiffres d'affaires compris. Sur
// le téléphone d'une boutique, que plusieurs vendeurs se passent, la personne suivante ne doit pas
// retrouver ces pages en revenant en arrière. Réparer le mode hors connexion ne doit pas ouvrir
// une fuite au passage.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "VIDER_CACHE") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => {
          if (event.ports && event.ports[0]) event.ports[0].postMessage({ ok: true });
        })
    );
  }
});
