"use client";

// Petite bulle d'aide pédagogique sur les cartes KPI — §13 "🔧 Amélioration" : rendre la
// distinction bénéfice comptable / argent réellement en caisse plus visible qu'une simple note en
// bas de page, pour des commerçants pas forcément familiers avec la comptabilité.
// Pas de librairie externe : clic pour ouvrir/fermer + fermeture au clic extérieur ou Échap.
// L'attribut `title` natif reste présent en secours (survol souris sur desktop).

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiPopover({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label="Explication"
        title={text}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-muted-foreground hover:text-primary"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 top-6 z-20 w-56 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-foreground shadow-lg"
        >
          {text}
        </div>
      )}
    </div>
  );
}
