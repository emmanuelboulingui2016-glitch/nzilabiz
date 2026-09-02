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
