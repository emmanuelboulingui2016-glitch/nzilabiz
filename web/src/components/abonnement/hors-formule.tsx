import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARGUMENTAIRE, LIBELLE_FONCTIONNALITE, type Fonctionnalite } from "@/lib/formules";

/**
 * Écran affiché à la place d'une page dont la fonctionnalité n'est pas dans la formule.
 *
 * Il montre ce que l'on obtient plutôt que ce que l'on n'a pas : un commerçant qui tombe sur un
 * mur fermé s'en va, un commerçant à qui l'on explique ce qu'il gagne réfléchit. Le bouton mène à
 * l'écran Abonnement, seul endroit où l'on peut changer de formule.
 */
export function HorsFormule({ fonctionnalite }: { fonctionnalite: Fonctionnalite }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Lock size={22} className="text-primary" />
      </div>

      <h1 className="text-lg font-bold">
        {LIBELLE_FONCTIONNALITE[fonctionnalite]} — formule Premium
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Votre formule Essentiel couvre la caisse, le stock, les clients et les créances. Premium
        ajoute le reste :
      </p>

      <ul className="mt-4 space-y-1.5 text-left text-sm">
        {ARGUMENTAIRE.PREMIUM.inclus.map((l) => (
          <li key={l} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {l}
          </li>
        ))}
      </ul>

      <Link href="/parametres/abonnement" className="mt-5 inline-block">
        <Button>Voir les formules</Button>
      </Link>
    </div>
  );
}
