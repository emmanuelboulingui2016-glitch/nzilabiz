"use client";

// Bouton « Continuer avec Google », partagé par la connexion et l'inscription.
//
// Le logo est un SVG en ligne plutôt qu'une image : il doit rester net sur tous les écrans, et
// surtout ne pas dépendre d'un fichier distant — un bouton d'authentification dont le logo met
// deux secondes à arriver est un bouton qu'on n'ose pas cliquer.
//
// Ses quatre couleurs sont écrites en dur, et c'est le seul endroit de l'application où c'est
// permis : ce sont celles de la marque Google, elles ne s'adaptent pas à une charte et ne suivent
// pas le mode sombre. Les altérer reviendrait à afficher un logo qui n'est plus le leur.

import { Button } from "@/components/ui/button";

function LogoGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function BoutonGoogle({ libelle }: { libelle: string }) {
  return (
    <a href="/api/auth/google" className="block">
      <Button type="button" variant="outline" className="h-12 w-full gap-3 rounded-full text-sm font-semibold">
        <LogoGoogle />
        {libelle}
      </Button>
    </a>
  );
}
