"use client";

// Compteur qui défile jusqu'à sa valeur quand la carte entre à l'écran.
// La valeur finale est affichée immédiatement si l'utilisateur a demandé moins d'animations.

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({
  value,
  suffix = "",
  duree = 1200,
}: {
  value: number;
  suffix?: string;
  duree?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [affiche, setAffiche] = useState(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    setAffiche(0);
    let frame = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();

        const depart = performance.now();
        const avancer = (maintenant: number) => {
          const t = Math.min((maintenant - depart) / duree, 1);
          // Décélération : rapide au début, posé à l'arrivée.
          const progression = 1 - Math.pow(1 - t, 3);
          setAffiche(Math.round(value * progression));
          if (t < 1) frame = requestAnimationFrame(avancer);
        };
        frame = requestAnimationFrame(avancer);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duree]);

  return (
    <span ref={ref}>
      {affiche}
      {suffix}
    </span>
  );
}
