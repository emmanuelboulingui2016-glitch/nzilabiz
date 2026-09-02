"use client";

// En-tête des pages publiques. Il se densifie au défilement (ombre et fond opaque) pour rester
// lisible par-dessus le contenu, et le menu mobile évite d'écraser les liens sur petit écran.
//
// Refonte : les liens de navigation sont regroupés dans une pastille (fond `bg-muted`) plutôt que
// posés à plat — c'est ce qui donne l'air « logiciel soigné » aux en-têtes actuels, sans ajouter
// de bordure. Les boutons d'action passent en pilule (`rounded-full`), conformément à la charte.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LIENS = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "Questions" },
];

export function PublicHeader() {
  const [defile, setDefile] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    const surveiller = () => setDefile(window.scrollY > 12);
    surveiller();
    window.addEventListener("scroll", surveiller, { passive: true });
    return () => window.removeEventListener("scroll", surveiller);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-300",
        defile
          ? "border-border bg-background/95 shadow-carte backdrop-blur"
          : "border-transparent bg-background"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 md:h-20 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/brand/nzilabiz-icone-transparent.png" alt="" width={32} height={32} />
          <span className="text-lg font-extrabold tracking-tight">NzilaBiz</span>
        </Link>

        {/* Pastille de navigation : les liens vivent ensemble dans un même fond, plutôt qu'à plat
            sur l'en-tête — moins de bordures, plus de structure visuelle. */}
        <nav className="ml-auto hidden items-center gap-1 rounded-full bg-muted/70 p-1 md:flex">
          {LIENS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/connexion"
            className="flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-carte transition-all hover:opacity-90 hover:shadow-vedette"
          >
            Essai gratuit
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <Link
            href="/inscription"
            className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-carte"
          >
            Essai gratuit
          </Link>
          <button
            onClick={() => setMenuOuvert((v) => !v)}
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOuvert}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            {menuOuvert ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid overflow-hidden border-t border-border transition-all duration-300 md:hidden",
          menuOuvert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] border-transparent opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {[...LIENS, { href: "/connexion", label: "Se connecter" }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOuvert(false)}
                className="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
