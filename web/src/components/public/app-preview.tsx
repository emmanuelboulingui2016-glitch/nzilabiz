"use client";

// Aperçu de l'application dans le hero : trois écrans représentatifs, en onglets, avec rotation
// automatique interrompue dès que le visiteur clique (il prend la main, on ne la lui reprend pas).
//
// Refonte « éditoriale » : la maquette est désormais une carte blanche flottante posée sur le
// panneau encre du hero, entourée de pastilles vertes qui nomment ce que fait l'application —
// exactement le motif de la référence. Les aperçus restent dessinés en HTML (pas de captures) :
// ils suivent la palette, restent nets sur tous les écrans et ne pèsent rien à charger.

import { useEffect, useState } from "react";
import { BarChart3, Package, ShoppingCart, Users, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

const ONGLETS = [
  { id: "vendre", label: "Vendre", icon: ShoppingCart },
  { id: "clients", label: "Clients", icon: Users },
  { id: "rapports", label: "Rapports", icon: BarChart3 },
] as const;

type OngletId = (typeof ONGLETS)[number]["id"];

const ROTATION_MS = 6000;

// Pastilles flottantes autour de la carte : positionnées en absolu, masquées sous `sm` pour ne
// pas déborder sur les petits écrans.
const PASTILLES = [
  { texte: "Fonctionne hors ligne", icon: WifiOff, pos: "-left-4 top-10 sm:-left-10" },
  { texte: "Stock à jour", icon: Package, pos: "-right-3 top-1/3 sm:-right-8" },
  { texte: "Rapports auto", icon: BarChart3, pos: "-right-2 bottom-16 sm:-right-6" },
] as const;

export function AppPreview() {
  const [actif, setActif] = useState<OngletId>("vendre");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setActif((courant) => {
        const index = ONGLETS.findIndex((o) => o.id === courant);
        return ONGLETS[(index + 1) % ONGLETS.length].id;
      });
    }, ROTATION_MS);
    return () => clearInterval(timer);
  }, [auto]);

  return (
    <div className="relative">
      {PASTILLES.map(({ texte, icon: Icone, pos }) => (
        <span
          key={texte}
          className={cn(
            "absolute z-10 hidden items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-vedette sm:inline-flex",
            pos,
          )}
          style={{ animation: "floatSoft 7s ease-in-out infinite" }}
        >
          <Icone size={13} /> {texte}
        </span>
      ))}

      <div className="rounded-[1.6rem] bg-white p-3 shadow-relief ring-1 ring-black/5 sm:p-4">
        <div className="mb-3 flex gap-1 rounded-xl bg-muted p-1">
          {ONGLETS.map(({ id, label, icon: Icone }) => (
            <button
              key={id}
              onClick={() => {
                setActif(id);
                setAuto(false);
              }}
              aria-pressed={actif === id}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-colors sm:text-sm",
                actif === id
                  ? "bg-white text-foreground shadow-carte"
                  : "text-muted-foreground hover:bg-white/60",
              )}
            >
              <Icone size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="min-h-72 rounded-2xl bg-white p-3 text-card-foreground sm:min-h-80">
          {actif === "vendre" ? (
            <ApercuVendre />
          ) : actif === "clients" ? (
            <ApercuClients />
          ) : (
            <ApercuRapports />
          )}
        </div>

        {auto ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Aperçu — cliquez un onglet pour explorer
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ApercuVendre() {
  const panier = [
    { nom: "Riz (sac 25 kg)", qte: 2, prix: 36000 },
    { nom: "Huile 5 L", qte: 1, prix: 9500 },
    { nom: "Sucre 1 kg", qte: 4, prix: 4000 },
  ];
  const total = panier.reduce((s, l) => s + l.prix, 0);

  return (
    <div className="animate-[fadeIn_.3s_ease-out] space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Panier en cours</p>
      {panier.map((l, i) => (
        <div
          key={l.nom}
          className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2"
          style={{ animation: `slideIn .35s ease-out ${i * 70}ms both` }}
        >
          <span className="min-w-0 truncate text-sm font-semibold">{l.nom}</span>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
            ×{l.qte} · {l.prix.toLocaleString("fr-FR")}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5">
        <span className="text-sm font-bold">Total</span>
        <span className="text-lg font-extrabold text-foret">{total.toLocaleString("fr-FR")} FCFA</span>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {["Espèces", "Mobile Money", "Crédit"].map((mode, i) => (
          <span
            key={mode}
            className={cn(
              "rounded-lg px-2 py-2 text-center text-[11px] font-bold",
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground",
            )}
          >
            {mode}
          </span>
        ))}
      </div>
    </div>
  );
}

// Les teintes de segment reprennent exactement celles de l'écran Clients réel (voir
// `SEGMENT_TONES` dans `components/clients/types.ts`) : fidèle en succès, récurrent en primaire,
// inactif en alerte. Un aperçu qui invente ses propres couleurs finit par mentir sur le produit.
function ApercuClients() {
  const clients = [
    { nom: "Mama Ngoua", segment: "Fidèle", ton: "success" as const, achats: 8, ca: 449000 },
    { nom: "Papa Obame", segment: "Fidèle", ton: "success" as const, achats: 6, ca: 536000 },
    { nom: "Chez Nadège", segment: "Récurrent", ton: "primary" as const, achats: 3, ca: 140000 },
    { nom: "J.-P. Ndong", segment: "Inactif", ton: "warning" as const, achats: 4, ca: 204500 },
  ];

  const TON_CLASSES = {
    success: "bg-success/15 text-success",
    primary: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
  } satisfies Record<string, string>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vos clients</p>
      {clients.map((c, i) => (
        <div
          key={c.nom}
          className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2"
          style={{ animation: `slideIn .35s ease-out ${i * 70}ms both` }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{c.nom}</p>
            <span
              className={cn(
                "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                TON_CLASSES[c.ton],
              )}
            >
              {c.segment}
            </span>
          </div>
          <div className="ml-2 shrink-0 text-right">
            <p className="text-sm font-extrabold">{c.ca.toLocaleString("fr-FR")}</p>
            <p className="text-[11px] text-muted-foreground">{c.achats} achats</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApercuRapports() {
  const barres = [
    { jour: "Lun", valeur: 45 },
    { jour: "Mar", valeur: 62 },
    { jour: "Mer", valeur: 38 },
    { jour: "Jeu", valeur: 78 },
    { jour: "Ven", valeur: 92 },
    { jour: "Sam", valeur: 100 },
    { jour: "Dim", valeur: 30 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "CA semaine", valeur: "1 284 000" },
          { label: "Marge", valeur: "31 %" },
          { label: "Ventes", valeur: "146" },
        ].map((k, i) => (
          <div
            key={k.label}
            className="rounded-lg bg-muted/60 p-2"
            style={{ animation: `slideIn .35s ease-out ${i * 70}ms both` }}
          >
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
            <p className="text-sm font-extrabold">{k.valeur}</p>
          </div>
        ))}
      </div>

      <div className="flex h-36 items-end justify-between gap-1.5 rounded-lg bg-muted/60 p-3">
        {barres.map((b, i) => (
          <div key={b.jour} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-primary"
              style={{ height: `${b.valeur}%`, animation: `growBar .5s ease-out ${i * 60}ms both` }}
            />
            <span className="text-[10px] text-muted-foreground">{b.jour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
