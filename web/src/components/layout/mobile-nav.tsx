"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Receipt, Package, Menu, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n/provider";
import { NAV_SECTIONS } from "./nav-config";
import { can, type Permission, type Role } from "@/lib/auth/rbac";
import { Dialog } from "@/components/ui/dialog";

const PRIMARY = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/vendre", icon: ShoppingCart, labelKey: "nav.vendre" },
  { href: "/ventes", icon: Receipt, labelKey: "nav.ventes" },
  { href: "/stock", icon: Package, labelKey: "nav.stock" },
];

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card md:hidden">
        {PRIMARY.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={20} />
              {t(labelKey)}
            </Link>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-muted-foreground"
        >
          <Menu size={20} />
          {t("nav.parametres")}
        </button>
      </nav>

      <Dialog open={open} onClose={() => setOpen(false)} title={t("common.actions")}>
        <div className="space-y-4">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => can(role, item.permission as Permission));
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
