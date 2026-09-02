"use client";

// Deux repères de lecture pour la page d'accueil : une barre de progression du défilement et un
// bouton de retour en haut qui n'apparaît qu'une fois le visiteur descendu.

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollProgress() {
  const [progression, setProgression] = useState(0);

  useEffect(() => {
    const calculer = () => {
      const hauteur = document.documentElement.scrollHeight - window.innerHeight;
      setProgression(hauteur > 0 ? (window.scrollY / hauteur) * 100 : 0);
    };
    calculer();
    window.addEventListener("scroll", calculer, { passive: true });
    window.addEventListener("resize", calculer);
    return () => {
      window.removeEventListener("scroll", calculer);
      window.removeEventListener("resize", calculer);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden>
      <div
        className="h-full bg-primary transition-[width] duration-150 ease-out"
        style={{ width: `${progression}%` }}
      />
    </div>
  );
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const surveiller = () => setVisible(window.scrollY > 600);
    surveiller();
    window.addEventListener("scroll", surveiller, { passive: true });
    return () => window.removeEventListener("scroll", surveiller);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Revenir en haut de la page"
      className={cn(
        "fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-relief transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <ArrowUp size={20} />
    </button>
  );
}
