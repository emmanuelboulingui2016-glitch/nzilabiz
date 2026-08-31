"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { NAV_SECTIONS } from "./nav-config";
import { useTranslations } from "@/lib/i18n/provider";
import { can, type Permission, type Role } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "lucide-react";
import { SelecteurBoutique, type BoutiqueOption } from "./selecteur-boutique";

// Le menu replié laisse les icônes visibles : sur un petit écran de portable (fréquent en
// boutique), ça rend une bonne moitié de la largeur à l'écran de caisse sans perdre la
// navigation. Le choix est mémorisé d'une session à l'autre.
const STORAGE_KEY = "nzilabiz.sidebar.collapsed";

export function Sidebar({
  role,
  userName,
  storeName,
  superAdmin = false,
  onLogout,
  boutiques = [],
  boutiqueActiveId,
}: {
  role: Role;
  userName: string;
  storeName: string;
  superAdmin?: boolean;
  onLogout: () => void;
  boutiques?: BoutiqueOption[];
  boutiqueActiveId?: string;
}) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const reseau = boutiques.length > 1;

  // Lu après le montage (et non à l'initialisation) : le serveur ne connaît pas localStorage,
  // le lire trop tôt provoquerait une erreur d'hydratation.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "flex-col gap-3 px-2")}>
        <Link
          href="/dashboard"
          className={cn("flex min-w-0 items-center gap-2", !collapsed && !reseau && "flex-1")}
          title={storeName || "NzilaBiz"}
        >
          <Image
            src="/brand/nzilabiz-icone-transparent.png"
            alt="NzilaBiz"
            width={32}
            height={32}
            className="shrink-0"
          />
          {collapsed || reseau ? null : (
            <span className="truncate text-lg font-extrabold">{storeName || "NzilaBiz"}</span>
          )}
        </Link>
        {/* Le sélecteur ne remplace le nom que lorsqu'il y a réellement plusieurs boutiques :
            une flèche dépliante sur une liste d'un seul élément n'apporte rien. */}
        {!collapsed && reseau && boutiqueActiveId ? (
          <SelecteurBoutique boutiques={boutiques} activeId={boutiqueActiveId} />
        ) : null}
        <button
          onClick={toggle}
          aria-label={collapsed ? t("nav.expandMenu") : t("nav.collapseMenu")}
          title={collapsed ? t("nav.expandMenu") : t("nav.collapseMenu")}
          aria-expanded={!collapsed}
          className={cn(
            "rounded-lg p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white",
            collapsed ? "" : "ml-auto"
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={cn("flex-1 space-y-5 overflow-y-auto overflow-x-hidden pb-4", collapsed ? "px-2" : "px-3")}>
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => can(role, item.permission as Permission));
          if (items.length === 0) return null;
          const SectionIcon = section.icon;
          return (
            <div key={section.titleKey}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-white/15" aria-hidden />
              ) : (
                <p className="mb-1.5 flex items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wider text-sidebar-muted">
                  <SectionIcon size={13} className="shrink-0" />
                  {t(section.titleKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const ItemIcon = item.icon;
                  const label = t(item.labelKey);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors",
                        collapsed ? "justify-center px-2" : "px-3",
                        active
                          ? "bg-white/15 font-bold text-white"
                          : "font-semibold text-sidebar-foreground/90 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <ItemIcon size={18} className="shrink-0" />
                      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
        {superAdmin ? (
          <Link
            href="/superadmin"
            title={collapsed ? "Administration" : undefined}
            className={cn(
              "mb-1 flex items-center gap-2.5 rounded-lg py-2 text-sm font-semibold text-accent transition-colors hover:bg-white/10",
              collapsed ? "justify-center px-2" : "px-3"
            )}
          >
            <ShieldCheck size={18} className="shrink-0" />
            {collapsed ? <span className="sr-only">Administration</span> : "Administration"}
          </Link>
        ) : null}
        <Link
          href="/parametres"
          title={collapsed ? t("nav.parametres") : undefined}
          className={cn(
            "mb-1 flex items-center gap-2.5 rounded-lg py-2 text-sm font-semibold text-sidebar-foreground/90 transition-colors hover:bg-white/10 hover:text-white",
            collapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <Settings size={18} className="shrink-0" />
          {collapsed ? <span className="sr-only">{t("nav.parametres")}</span> : t("nav.parametres")}
        </Link>
        <div
          className={cn(
            "flex items-center rounded-lg py-2",
            collapsed ? "justify-center px-2" : "justify-between px-3"
          )}
        >
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{userName}</p>
              <p className="truncate text-xs font-medium text-sidebar-muted">{role}</p>
            </div>
          )}
          <button
            onClick={onLogout}
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
