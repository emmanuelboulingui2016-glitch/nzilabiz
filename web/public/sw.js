// NzilaBiz — service worker minimal, écrit à la main.
//
// 🔧 Écart documenté (voir README « Écarts vs cahier des charges ») : le plugin `next-pwa`
// s'appuie sur une configuration Webpack (workbox-webpack-plugin). Next.js 16 utilise Turbopack
// par défaut pour `next build`, et un `build` avec configuration Webpack personnalisée échoue
// volontairement pour éviter les erreurs silencieuses. Plutôt que de forcer `--webpack` (perdant
// les gains de Turbopack) nous avons écrit ce service worker à la main : il gère l'installabilité
// PWA (cache de l'app shell + fallback hors-ligne). La vraie logique offline-first de l'application
// (ventes, stock, dépenses saisis sans réseau) est assurée séparément par la couche IndexedDB/Dexie
// (voir src/lib/offline/db.ts), pas par ce service worker.

const CACHE_NAME = "nzilabiz-shell-v1";
const APP_SHELL = [
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigation (changement de page) : réseau d'abord, repli sur le cache puis sur la page hors-ligne.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  // API : toujours réseau (les données passent par IndexedDB pour le mode hors-ligne, pas par le SW).
  if (new URL(request.url).pathname.startsWith("/api/")) return;

  // Assets statiques : cache d'abord, réseau en repli.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
