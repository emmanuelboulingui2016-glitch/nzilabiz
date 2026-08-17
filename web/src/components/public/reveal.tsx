"use client";

// Révélation d'un bloc à son entrée dans l'écran.
//
// Implémenté avec IntersectionObserver plutôt qu'une bibliothèque d'animation : aucune dépendance
// supplémentaire, et la politique de sécurité du site interdit de toute façon les scripts externes.
//
// Deux garde-fous : le contenu est visible par défaut si JavaScript ne s'exécute pas (on part de
// l'état visible et on n'anime que si l'observateur prend la main), et l'animation est
// entièrement désactivée pour qui a demandé « moins d'animations » dans son système.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Décalage en millisecondes, pour faire apparaître une grille en cascade. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [anime, setAnime] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    setAnime(true);
    setVisible(false);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Déclenche un peu avant que le bloc n'atteigne le bas de l'écran : l'animation est déjà
      // finie quand le regard arrive dessus.
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={anime ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        anime && "transition-all duration-700 ease-out",
        anime && (visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"),
        className
      )}
    >
      {children}
    </div>
  );
}
