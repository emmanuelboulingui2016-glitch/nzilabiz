"use client";

// Barre latérale de l'administration — même logique que celle de la boutique (repliable, choix
// mémorisé), mais avec ses propres entrées et une teinte distincte : on ne doit jamais confondre
// « j'administre la plateforme » et « je tiens ma boutique ».

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "nzilabiz.superadmin.sidebar";

const SECTIONS = [
  {
    titre: "Pilotage",
    items: [{ href: "/superadmin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true }],
  },
  {
    titre: "Plateforme",
    items: [
      { href: "/superadmin/boutiques", label: "Boutiques", icon: Building2 },
      // Titulaires (rôle PATRON) uniquement — jamais les gérants/vendeurs des boutiques clientes,
      // voir la justification dans `src/app/api/superadmin/utilisateurs/route.ts`.
      { href: "/superadmin/utilisateurs", label: "Titulaires", icon: Users },
    ],
  },
  {
    titre: "Exploitation",
    items: [
      { href: "/superadmin/support", label: "Support", icon: LifeBuoy },
      { href: "/superadmin/reglages", label: "Réglages", icon: Settings },
    ],
  },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [replie, setReplie] = useState(false);

  useEffect(() => {
    setReplie(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function basculer() {
    setReplie((prev) => {
      const suivant = !prev;
      window.localStorage.setItem(STORAGE_KEY, suivant ? "1" : "0");
      return suivant;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        replie ? "w-[76px]" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 py-5", replie && "flex-col gap-3 px-2")}>
        <Link href="/superadmin" className="flex min-w-0 items-center gap-2" title="Administration">
          <Image src="/brand/nzilabiz-icone-transparent.png" alt="" width={38} height={38} className="shrink-0" />
          {replie ? null : (
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold leading-tight">NzilaBiz</span>
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-accent">
                <ShieldCheck size={11} /> Administration
              </span>
            </span>
          )}
        </Link>
        <button
          onClick={basculer}
          aria-label={replie ? "Déplier le menu" : "Replier le menu"}
          title={replie ? "Déplier le menu" : "Replier le menu"}
          aria-expanded={!replie}
          className={cn(
            "rounded-lg p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white",
            replie ? "" : "ml-auto"
          )}
        >
          {replie ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className={cn("flex-1 space-y-5 overflow-y-auto overflow-x-hidden pb-4", replie ? "px-2" : "px-3")}>
        {SECTIONS.map((section) => (
          <div key={section.titre}>
            {replie ? (
              <div className="mx-auto mb-2 h-px w-8 bg-white/15" aria-hidden />
            ) : (
              <p className="mb-1.5 px-3 text-xs font-bold uppercase tracking-wider text-sidebar-muted">
                {section.titre}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const actif =
                  "exact" in item && item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icone = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={replie ? item.label : undefined}
                    aria-current={actif ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors",
                      replie ? "justify-center px-2" : "px-3",
                      actif
                        ? "bg-white/15 font-bold text-white"
                        : "font-semibold text-sidebar-foreground/90 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icone size={18} className="shrink-0" />
                    {replie ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-white/10 p-3", replie && "px-2")}>
        <Link
          href="/dashboard"
          title={replie ? "Ma boutique" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg py-2 text-sm font-semibold text-sidebar-foreground/90 transition-colors hover:bg-white/10 hover:text-white",
            replie ? "justify-center px-2" : "px-3"
          )}
        >
          <Store size={18} className="shrink-0" />
          {replie ? <span className="sr-only">Ma boutique</span> : "Ma boutique"}
        </Link>
        {replie ? null : (
          <p className="mt-2 truncate px-3 text-xs text-sidebar-muted" title={email}>
            {email}
          </p>
        )}
      </div>
    </aside>
  );
}

// Navigation de repli sur mobile : les mêmes entrées, en barre horizontale défilante.
export function AdminMobileNav() {
  const pathname = usePathname();
  const items = SECTIONS.flatMap((s) => s.items);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
      {items.map((item) => {
        const actif =
          "exact" in item && item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(item.href + "/");
        const Icone = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              actif ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icone size={15} /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
