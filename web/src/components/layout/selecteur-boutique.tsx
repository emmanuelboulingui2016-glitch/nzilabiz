"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoutiqueOption = { id: string; nom: string };

/**
 * Bascule d'une boutique à l'autre — réseau Entreprise.
 *
 * Ne s'affiche que si le compte a réellement accès à plusieurs boutiques. Pour l'immense majorité
 * des commerçants, qui n'en ont qu'une, l'interface est exactement celle d'avant : le nom de la
 * boutique, en texte.
 *
 * Après la bascule, on repart du tableau de bord plutôt que de rafraîchir l'écran courant : la
 * page ouverte peut être la fiche d'une vente ou d'un produit de l'ancienne boutique, qui
 * n'existe pas dans la nouvelle.
 */
export function SelecteurBoutique({
  boutiques,
  activeId,
  variante = "sidebar",
}: {
  boutiques: BoutiqueOption[];
  activeId: string;
  variante?: "sidebar" | "compact";
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const auClic = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, []);

  const active = boutiques.find((b) => b.id === activeId);

  async function basculer(id: string) {
    if (id === activeId || enCours) return;
    setEnCours(id);
    setErreur(null);
    try {
      const res = await fetch("/api/boutiques/basculer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErreur(data?.error ?? "Changement de boutique impossible.");
        setEnCours(null);
        return;
      }
      setOuvert(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErreur("Vous semblez hors connexion. Réessayez une fois le réseau revenu.");
      setEnCours(null);
    }
  }

  const compact = variante === "compact";

  return (
    <div ref={boite} className={cn("relative", compact ? "" : "min-w-0 flex-1")}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        title={`${active?.nom ?? "Boutique"} — changer de boutique`}
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 rounded-lg text-left transition-colors",
          compact
            ? "h-9 max-w-[10rem] border border-border bg-background px-2 text-sm font-semibold hover:bg-muted"
            : "px-1.5 py-1 text-lg font-extrabold text-sidebar-foreground hover:bg-white/10"
        )}
      >
        {compact ? <Building2 size={15} className="shrink-0 text-muted-foreground" /> : null}
        <span className="truncate">{active?.nom ?? "Boutique"}</span>
        <ChevronDown size={compact ? 14 : 16} className="ml-auto shrink-0 opacity-70" />
      </button>

      {ouvert ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xl",
            compact ? "left-0 w-64" : "left-0 right-0 min-w-56"
          )}
        >
          <p className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Mes boutiques
          </p>
          <ul className="max-h-72 overflow-y-auto">
            {boutiques.map((b) => {
              const actif = b.id === activeId;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => basculer(b.id)}
                    disabled={enCours !== null}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-60",
                      actif && "font-bold"
                    )}
                  >
                    {enCours === b.id ? (
                      <Loader2 size={15} className="shrink-0 animate-spin text-primary" />
                    ) : actif ? (
                      <Check size={15} className="shrink-0 text-primary" />
                    ) : (
                      <span className="w-[15px] shrink-0" />
                    )}
                    <span className="truncate">{b.nom}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {erreur ? <p className="border-t border-border px-3 py-2 text-xs text-danger">{erreur}</p> : null}
          <Link
            href="/boutiques"
            onClick={() => setOuvert(false)}
            className="block border-t border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
          >
            Vue d&apos;ensemble du réseau
          </Link>
        </div>
      ) : null}
    </div>
  );
}
