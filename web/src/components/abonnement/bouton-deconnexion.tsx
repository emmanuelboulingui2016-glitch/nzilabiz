"use client";

// La route de déconnexion est en POST uniquement : un simple lien renverrait 405. Ce bouton
// reproduit le geste de la barre latérale (app-shell.tsx) via la même fonction partagée
// (lib/auth/deconnexion.ts) — l'écran de blocage remplaçant toute l'interface, il lui faut le
// sien. Il appelait auparavant l'API de déconnexion sans rien vider d'autre : sur un appareil
// partagé entre vendeurs, le suivant retrouvait le catalogue (prix d'achat compris) et les pages
// mises en cache du compte précédent.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { deconnecterCompletement } from "@/lib/auth/deconnexion";

export function BoutonDeconnexion() {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);

  const deconnecter = async () => {
    setOccupe(true);
    try {
      // `false` : l'utilisateur a annulé après avoir été prévenu de ventes encore en attente
      // d'envoi. On le laisse sur l'écran de blocage, toujours connecté, plutôt que de risquer de
      // perdre des ventes déjà encaissées.
      const deconnecte = await deconnecterCompletement();
      if (!deconnecte) {
        setOccupe(false);
        return;
      }
      router.push("/connexion");
      router.refresh();
    } catch {
      // Le cookie n'a pas pu être effacé côté serveur : on renvoie tout de même vers la connexion
      // plutôt que de laisser la personne devant un écran figé sans explication.
      router.push("/connexion");
    }
  };

  return (
    <button
      type="button"
      onClick={deconnecter}
      disabled={occupe}
      className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline disabled:opacity-60"
    >
      <LogOut size={14} /> {occupe ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
