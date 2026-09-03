"use client";

// Accordéon de questions fréquentes : une seule réponse ouverte à la fois, avec ouverture animée.
// La hauteur est animée via une grille (grid-template-rows 0fr → 1fr), qui contrairement à
// max-height ne demande pas de deviner une hauteur maximale.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Faq({ items }: { items: { question: string; reponse: string }[] }) {
  const [ouvert, setOuvert] = useState<number | null>(0);

  return (
    <div className="mt-9 space-y-3">
      {items.map((item, index) => {
        const estOuvert = ouvert === index;
        return (
          <div
            key={item.question}
            className={cn(
              // La section qui entoure cet accordéon reste sur le fond crème par défaut : chaque
              // question a donc besoin d'un fond blanc (bg-card) pour se détacher, l'ombre seule
              // ne suffirait pas sur une couleur identique à celle du dessous.
              "overflow-hidden rounded-[1.25rem] bg-card transition-shadow",
              estOuvert ? "shadow-relief" : "shadow-carte"
            )}
          >
            <button
              onClick={() => setOuvert(estOuvert ? null : index)}
              aria-expanded={estOuvert}
              className="flex min-h-14 w-full items-center justify-between gap-4 p-4 text-left"
            >
              <span className="text-base font-bold">{item.question}</span>
              <ChevronDown
                size={18}
                className={cn(
                  "shrink-0 text-muted-foreground transition-transform duration-300",
                  estOuvert && "rotate-180 text-primary"
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                estOuvert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.reponse}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
