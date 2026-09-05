"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Champ mot de passe avec bascule de visibilité. Un composant à part plutôt qu'une option sur
// `Input` : `Input` sert à tous les types de champs (texte, e-mail, téléphone...) et la grande
// majorité de ses usages n'ont rien à voir avec un mot de passe. Faire porter cette logique par un
// composant dédié évite d'alourdir `Input` pour tout le monde, pour une bascule qui ne concerne
// qu'une poignée de champs bien identifiés.
//
// Les commerçants saisissent souvent au clavier tactile, parfois en plein soleil : ne pas pouvoir
// relire un mot de passe fait perdre des inscriptions et des accès. La bascule est donc masquée
// par défaut, toujours, et ne s'active qu'à la demande.
export const InputMotDePasse = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            // pr-11 réserve la place du bouton : le texte saisi ne doit jamais passer dessous.
            "flex h-11 w-full rounded-lg border border-border bg-card px-3 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/30",
            className
          )}
          {...props}
        />
        <button
          // Un <button> sans type, placé dans un <form>, se comporte comme un bouton de
          // soumission : au clic, il enverrait le formulaire avant même que le mot de passe soit
          // complet. "button" l'empêche d'agir sur autre chose que l'affichage.
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
InputMotDePasse.displayName = "InputMotDePasse";
