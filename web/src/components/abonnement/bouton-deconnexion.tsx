"use client";

// La route de déconnexion est en POST uniquement : un simple lien renverrait 405. Ce bouton
// reproduit le geste de la barre latérale (app-shell.tsx), seul endroit où la déconnexion existait
// jusqu'ici — l'écran de blocage remplaçant toute l'interface, il lui faut le sien.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function BoutonDeconnexion() {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);

  const deconnecter = async () => {
    setOccupe(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
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
