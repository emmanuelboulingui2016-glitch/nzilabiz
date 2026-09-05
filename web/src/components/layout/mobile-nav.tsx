"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Receipt, Package, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/provider";
import { NAV_SECTIONS } from "./nav-config";
import type { Permission } from "@/lib/auth/rbac";
import { formuleOuvre } from "@/lib/formules";
import { Dialog } from "@/components/ui/dialog";

const PRIMARY = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/vendre", icon: ShoppingCart, labelKey: "nav.vendre" },
  { href: "/ventes", icon: Receipt, labelKey: "nav.ventes" },
  { href: "/stock", icon: Package, labelKey: "nav.stock" },
];

export function MobileNav({
  permissions,
  formule = "ESSAI",
}: {
  /**
   * Permissions effectives (matrice du rôle + dérogations individuelles — §14) — voir le
   * commentaire équivalent dans sidebar.tsx. Remplace l'ancien filtrage par seul rôle : un employé
   * à qui un droit a été retiré ne doit plus voir l'entrée correspondante ici non plus.
   */
  permissions: Permission[];
  formule?: string;
}) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Refonte 2026 : l'ombre remplace le trait de séparation, et l'onglet actif porte une
          pastille pleine au lieu d'une simple couleur — sur un petit écran tenu à bout de bras, une
          teinte de texte ne suffit pas à dire où l'on est. Hauteur portée à 68 px : la zone tactile
          de chaque onglet dépasse ainsi les 44 px recommandés, marges comprises. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-center justify-around border-t border-border/60 bg-card px-1 shadow-relief md:hidden">
        {PRIMARY.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon size={20} />
              {t(labelKey)}
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className="flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted"
        >
          <Menu size={20} />
          {t("nav.parametres")}
        </button>
      </nav>

      <Dialog open={open} onClose={() => setOpen(false)} title={t("common.actions")}>
        <div className="space-y-4">
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
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                  <SectionIcon size={13} />
                  {t(section.titleKey)}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted"
                      >
                        <ItemIcon size={18} className="shrink-0 text-muted-foreground" />
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <Link
            href="/parametres"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Settings size={18} className="shrink-0 text-muted-foreground" />
            {t("nav.parametres")}
          </Link>
        </div>
      </Dialog>
    </>
  );
}
