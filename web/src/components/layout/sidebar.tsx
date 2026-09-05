"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { NAV_SECTIONS } from "./nav-config";
import { useTranslations } from "@/lib/i18n/provider";
import type { Permission, Role } from "@/lib/auth/rbac";
import { formuleOuvre } from "@/lib/formules";
import { cn } from "@/lib/utils";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "lucide-react";
import { SelecteurBoutique, type BoutiqueOption } from "./selecteur-boutique";

// Le menu replié laisse les icônes visibles : sur un petit écran de portable (fréquent en
// boutique), ça rend une bonne moitié de la largeur à l'écran de caisse sans perdre la
// navigation. Le choix est mémorisé d'une session à l'autre.
const STORAGE_KEY = "nzilabiz.sidebar.collapsed";

export function Sidebar({
  role,
  permissions,
  userName,
  storeName,
  superAdmin = false,
  onLogout,
  boutiques = [],
  boutiqueActiveId,
  formule = "ESSAI",
}: {
  role: Role;
  /**
   * Permissions effectives de la personne connectée (matrice du rôle + dérogations individuelles
   * — §14). Décide des entrées affichées, à la place d'un simple `can(role, ...)` : un employé à
   * qui le patron a retiré un droit ne doit plus voir l'entrée correspondante, sinon il clique et
   * se prend un refus côté API — mauvaise expérience, impression de logiciel cassé. Calculées une
   * fois côté serveur (voir `peut`/`getSession` dans lib/auth/session.ts) et transmises telles
   * quelles ; ce composant ne fait plus lui-même l'hypothèse « droit = rôle seul ».
   */
  permissions: Permission[];
  userName: string;
  storeName: string;
  superAdmin?: boolean;
  onLogout: () => void;
  boutiques?: BoutiqueOption[];
  boutiqueActiveId?: string;
  /** Formule de la boutique : les entrées hors formule disparaissent du menu. */
  formule?: string;
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

  // Initiale de l'utilisateur pour l'avatar du pied de menu — un simple rond coloré vaut mieux
  // qu'un bloc de texte pour ancrer visuellement "qui est connecté".
  const initiale = (userName.trim().charAt(0) || "?").toUpperCase();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 py-6", collapsed && "flex-col gap-3 px-2")}>
        <Link
          href="/dashboard"
          className={cn("flex min-w-0 items-center gap-2", !collapsed && !reseau && "flex-1")}
          title={storeName || "NzilaBiz"}
        >
          <Image
            src="/brand/nzilabiz-icone-transparent.png"
            alt="NzilaBiz"
            width={38}
            height={38}
            className="shrink-0"
          />
          {collapsed || reseau ? null : (
            <span className="truncate text-lg font-extrabold tracking-tight">{storeName || "NzilaBiz"}</span>
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
            "rounded-lg p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            collapsed ? "" : "ml-auto"
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={cn("flex-1 space-y-6 overflow-y-auto overflow-x-hidden pb-4", collapsed ? "px-2" : "px-3")}>
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
            (item) =>
              permissions.includes(item.permission) &&
              (!item.fonctionnalite || formuleOuvre(formule, item.fonctionnalite))
          );
          if (items.length === 0) return null;
          const SectionIcon = section.icon;
          return (
            <div key={section.titleKey}>
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-white/15" aria-hidden />
              ) : (
                <p className="mb-2 flex items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wider text-sidebar-muted">
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
                        // Filet d'accent à gauche (accent = vert clair de la marque) : un repère
                        // supplémentaire pour l'entrée active, sans changer la largeur des autres —
                        // le filet transparent occupe déjà la place.
                        "flex items-center gap-2.5 rounded-lg border-l-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                        collapsed ? "justify-center border-l-0 px-2" : "pl-[10px] pr-3",
                        active
                          ? "border-accent bg-white/15 font-bold text-white"
                          : "border-transparent font-semibold text-sidebar-foreground/80 hover:bg-white/10 hover:text-white"
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
              "mb-1 flex items-center gap-2.5 rounded-lg py-2 text-sm font-semibold text-accent transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
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
            "mb-1 flex items-center gap-2.5 rounded-lg py-2 text-sm font-semibold text-sidebar-foreground/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            collapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <Settings size={18} className="shrink-0" />
          {collapsed ? <span className="sr-only">{t("nav.parametres")}</span> : t("nav.parametres")}
        </Link>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg py-1.5",
            collapsed ? "justify-center px-2" : "justify-between px-3"
          )}
        >
          {collapsed ? null : (
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white"
              >
                {initiale}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{userName}</p>
                <p className="truncate text-xs font-medium text-sidebar-muted">{role}</p>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            aria-label={t("nav.logout")}
            title={t("nav.logout")}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
