"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import type { Role } from "@/lib/auth/rbac";
import { PwaInstallBanner } from "./pwa-install-banner";
import { AnnouncementBanner } from "./announcement-banner";
import type { BoutiqueOption } from "./selecteur-boutique";

export function AppShell({
  children,
  role,
  userName,
  storeName,
  superAdmin = false,
  annonce = null,
  boutiques = [],
  boutiqueActiveId,
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
}) {
  const router = useRouter();

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar boutiques={boutiques} boutiqueActiveId={boutiqueActiveId} />
        {annonce ? <AnnouncementBanner message={annonce} /> : null}
        <PwaInstallBanner />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">{children}</main>
      </div>
      <MobileNav role={role} />
    </div>
  );
}
