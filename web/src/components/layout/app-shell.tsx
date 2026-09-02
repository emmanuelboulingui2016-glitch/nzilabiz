"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import type { Role } from "@/lib/auth/rbac";
import { PwaInstallBanner } from "./pwa-install-banner";
import { AnnouncementBanner } from "./announcement-banner";
import type { BoutiqueOption } from "./selecteur-boutique";
import { startAutoSync } from "@/lib/offline/sync-engine";

/**
 * Écrans que le commerçant doit pouvoir ouvrir sans réseau. La caisse d'abord : c'est celle qui
 * fait rentrer l'argent, et la seule dont l'absence coûte une vente.
 */
const ECRANS_HORS_LIGNE = ["/vendre", "/dashboard", "/stock", "/clients", "/ventes"];

/**
 * Demande au service worker d'aller chercher ces écrans et de les garder.
 *
 * Sans cette demande, le cache ne contenait presque rien — et c'est l'erreur de raisonnement qui a
 * fait échouer la première correction. On croyait qu'il suffisait de conserver une copie de chaque
 * page visitée. Mais dans l'App Router de Next.js, **une seule page est réellement « visitée » au
 * sens du navigateur** : celle par laquelle on entre. Tous les changements d'écran qui suivent
 * sont des navigations côté client — l'adresse change, le contenu est remplacé, mais aucune
 * requête de navigation n'est émise.
 *
 * Un commerçant qui se connecte sur `/connexion` puis atterrit sur `/dashboard` n'a donc jamais
 * fait charger `/dashboard` au navigateur. Rouvrir l'application hors réseau ramenait la page de
 * connexion, faute de mieux.
 *
 * Différé de quelques secondes : le préchargement ne doit pas disputer la bande passante au
 * premier affichage, qui est ce que le commerçant attend.
 */
function prechargerEcrans() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({ type: "PRECHARGER", urls: ECRANS_HORS_LIGNE });
    })
    .catch(() => {
      // Pas de service worker actif : l'application reste utilisable, sans le mode hors connexion.
    });
}

/**
 * Vide les caches du service worker à la déconnexion.
 *
 * Depuis que le mode hors connexion fonctionne, le cache contient le HTML des pages visitées —
 * `/dashboard` et ses chiffres d'affaires compris. Sur le téléphone d'une boutique, que plusieurs
 * vendeurs se passent, la personne suivante ne doit pas les retrouver en revenant en arrière.
 * L'échec n'est pas bloquant : on ne va pas retenir quelqu'un sur sa session parce qu'un cache
 * refuse de se vider.
 */
async function viderCachePages() {
  try {
    const sw = navigator.serviceWorker?.controller;
    if (sw) sw.postMessage({ type: "VIDER_CACHE" });
  } catch (e) {
    console.error("déconnexion : vidage du cache impossible —", e instanceof Error ? e.message : e);
  }
}

export function AppShell({
  children,
  role,
  userName,
  storeName,
  superAdmin = false,
  annonce = null,
  boutiques = [],
  boutiqueActiveId,
  formule = "ESSAI",
}: {
  children: ReactNode;
  role: Role;
  userName: string;
  storeName: string;
  /** Affiche l'accès à l'administration de la plateforme. Le droit réel est revérifié côté serveur. */
  superAdmin?: boolean;
  /** Annonce publiée depuis l'administration, affichée en bandeau. */
  annonce?: string | null;
  /** Boutiques accessibles au compte. Une seule dans le cas courant : rien ne s'affiche alors. */
  boutiques?: BoutiqueOption[];
  boutiqueActiveId?: string;
  /** Formule de la boutique — décide des entrées de menu affichées. */
  formule?: string;
}) {
  const router = useRouter();

  // Le moteur de synchronisation tourne au-dessus de toutes les pages, pas seulement sur la
  // caisse. Il n'était démarré que par l'écran Vendre : un vendeur qui encaissait hors connexion
  // puis passait au stock n'avait plus rien pour renvoyer ses ventes, même une fois le réseau
  // revenu. Elles restaient indéfiniment dans le téléphone.
  useEffect(() => startAutoSync(), []);

  // Le cache se remplit dès que l'application est chargée et le réseau disponible, puis à chaque
  // retour du réseau : c'est le moment où l'on peut préparer la prochaine coupure.
  useEffect(() => {
    const t = setTimeout(prechargerEcrans, 4000);
    window.addEventListener("online", prechargerEcrans);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", prechargerEcrans);
    };
  }, []);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await viderCachePages();
    router.push("/connexion");
    router.refresh();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <Sidebar
        role={role}
        userName={userName}
        storeName={storeName}
        superAdmin={superAdmin}
        onLogout={onLogout}
        boutiques={boutiques}
        boutiqueActiveId={boutiqueActiveId}
        formule={formule}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar boutiques={boutiques} boutiqueActiveId={boutiqueActiveId} />
        {annonce ? <AnnouncementBanner message={annonce} /> : null}
        <PwaInstallBanner />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">{children}</main>
      </div>
      <MobileNav role={role} formule={formule} />
    </div>
  );
}
