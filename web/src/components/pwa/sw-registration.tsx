"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Échec silencieux — l'app reste utilisable sans le service worker (moins l'installabilité PWA).
      });
    }
  }, []);

  return null;
}
