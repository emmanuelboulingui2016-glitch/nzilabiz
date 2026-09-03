"use client";

// En-tête des pages publiques, refonte « éditoriale ».
//
// Fond blanc franc, mot-symbole en serif à gauche, liens de navigation posés à plat au centre
// (plus de pastille : la référence les laisse respirer), et à droite un lien discret « Se
// connecter » suivi du bouton signature (pilule encre + carré vert). L'en-tête se densifie
// légèrement au défilement — une simple bordure basse et une ombre ténue — pour rester lisible
// par-dessus le contenu.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoutonCta } from "./bouton-cta";

const LIENS = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#tarifs", label: "Tarifs" },
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
        "sticky top-0 z-40 transition-all duration-300",
        defile
          ? "border-b border-border bg-background/90 shadow-carte backdrop-blur"
          : "border-b border-transparent bg-background",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 md:h-20 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image src="/brand/nzilabiz-icone-transparent.png" alt="" width={42} height={42} className="shrink-0" />
          <span className="font-serif text-2xl font-semibold tracking-tight sm:text-[1.7rem]">NzilaBiz</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 md:flex">
          {LIENS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 md:ml-7 md:flex">
          <Link
            href="/connexion"
            className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Se connecter
          </Link>
          <BoutonCta href="/inscription">Essai gratuit</BoutonCta>
        </div>

        <div className="ml-auto flex items-center gap-2 md:hidden">
          <BoutonCta href="/inscription">Essai</BoutonCta>
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
          menuOuvert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] border-transparent opacity-0",
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
