"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import type { Role } from "@/lib/auth/rbac";
import { PwaInstallBanner } from "./pwa-install-banner";

export function AppShell({
  children,
  role,
  userName,
  storeName,
  notificationCount,
}: {
  children: ReactNode;
  role: Role;
  userName: string;
  storeName: string;
  notificationCount?: number;
}) {
  const router = useRouter();

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/connexion");
    router.refresh();
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <Sidebar role={role} userName={userName} storeName={storeName} onLogout={onLogout} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar notificationCount={notificationCount} />
        <PwaInstallBanner />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">{children}</main>
      </div>
      <MobileNav role={role} />
    </div>
  );
}
