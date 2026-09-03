import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Bouton d'appel à l'action de la vitrine, repris de la référence : une pilule sombre (ou claire
// sur fond sombre) suivie d'un carré arrondi vert qui tient une flèche diagonale. Le carré garde
// sa couleur d'accent quel que soit le fond, c'est lui la signature visuelle.
//
// `ton` :
//  - "encre"  : pilule encre, texte clair — sur fond blanc (défaut)
//  - "clair"  : pilule blanche, texte encre — sur un panneau encre
//  - "vert"   : pilule verte, texte blanc — variante pleine sur fond blanc

type Ton = "encre" | "clair" | "vert";

const PILULE: Record<Ton, string> = {
  encre: "bg-encre text-encre-foreground hover:bg-encre/90",
  clair: "bg-white text-encre hover:bg-white/90",
  vert: "bg-primary text-primary-foreground hover:bg-primary/90",
};

const CARRE: Record<Ton, string> = {
  encre: "bg-primary text-primary-foreground",
  clair: "bg-primary text-primary-foreground",
  vert: "bg-white/20 text-white",
};

export function BoutonCta({
  href,
  children,
  ton = "encre",
  taille = "md",
  className,
}: {
  href: string;
  children: React.ReactNode;
  ton?: Ton;
  taille?: "md" | "lg";
  className?: string;
}) {
  const grand = taille === "lg";
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full font-bold transition-colors",
        grand ? "h-14 pl-6 pr-2 text-base" : "h-12 pl-5 pr-1.5 text-sm",
        PILULE[ton],
        className,
      )}
    >
      {children}
      <span
        className={cn(
          "flex items-center justify-center rounded-[0.65rem] transition-transform duration-300 group-hover:rotate-45",
          grand ? "h-10 w-10" : "h-9 w-9",
          CARRE[ton],
        )}
      >
        <ArrowUpRight size={grand ? 20 : 18} strokeWidth={2.5} />
      </span>
    </Link>
  );
}
