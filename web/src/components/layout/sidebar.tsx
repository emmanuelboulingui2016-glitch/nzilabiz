"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { NAV_SECTIONS } from "./nav-config";
import { useTranslations } from "@/lib/i18n/provider";
import { can, type Permission, type Role } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { LogOut, Settings } from "lucide-react";

export function Sidebar({
  role,
  userName,
  storeName,
  onLogout,
}: {
  role: Role;
  userName: string;
  storeName: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-4 py-5">
        <Image src="/brand/nzilabiz-icone-transparent.png" alt="NzilaBiz" width={32} height={32} />
        <span className="truncate font-extrabold text-lg">{storeName || "NzilaBiz"}</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => can(role, item.permission as Permission));
          if (items.length === 0) return null;
          return (
            <div key={section.titleKey}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-muted">
                {t(section.titleKey)}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white/15 text-white" : "text-sidebar-foreground/85 hover:bg-white/10"
                      )}
                    >
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/parametres"
          className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/85 hover:bg-white/10"
        >
          <Settings size={16} />
          {t("nav.parametres")}
        </Link>
        <div className="flex items-center justify-between rounded-lg px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-sidebar-muted">{role}</p>
          </div>
          <button onClick={onLogout} aria-label={t("nav.logout")} className="rounded-lg p-1.5 hover:bg-white/10">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
