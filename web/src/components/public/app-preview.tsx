"use client";

// Aperçu de l'application dans la page d'accueil : trois écrans représentatifs, en onglets, avec
// rotation automatique interrompue dès que le visiteur clique (il prend la main, on ne la lui
// reprend pas).
//
// Les aperçus sont dessinés en HTML plutôt qu'avec des captures d'écran : ils suivent la palette
// et le thème clair/sombre, restent nets sur tous les écrans et ne pèsent rien à charger.

import { useEffect, useState } from "react";
import { BarChart3, ShoppingCart, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ONGLETS = [
  { id: "vendre", label: "Vendre", icon: ShoppingCart },
  { id: "clients", label: "Clients", icon: Users },
  { id: "rapports", label: "Rapports", icon: BarChart3 },
] as const;

type OngletId = (typeof ONGLETS)[number]["id"];

const ROTATION_MS = 6000;

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
    <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 sm:p-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-black/20 p-1">
        {ONGLETS.map(({ id, label, icon: Icone }) => (
          <button
            key={id}
            onClick={() => {
              setActif(id);
              setAuto(false);
            }}
            aria-pressed={actif === id}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition-colors sm:text-sm",
              actif === id ? "bg-white/15 text-white" : "text-sidebar-muted hover:bg-white/10"
            )}
          >
            <Icone size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-72 rounded-xl bg-white/95 p-3 text-[#14261d] shadow-inner sm:min-h-80">
        {actif === "vendre" ? <ApercuVendre /> : actif === "clients" ? <ApercuClients /> : <ApercuRapports />}
      </div>

      {auto ? (
        <p className="mt-2 text-center text-[11px] text-sidebar-muted">
          Aperçu — cliquez un onglet pour explorer
        </p>
      ) : null}
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
      <p className="text-xs font-bold uppercase tracking-wider text-[#5b6b62]">Panier en cours</p>
      {panier.map((l, i) => (
        <div
          key={l.nom}
          className="flex items-center justify-between rounded-lg border border-[#e2e6df] px-3 py-2"
          style={{ animation: `slideIn .35s ease-out ${i * 70}ms both` }}
        >
          <span className="min-w-0 truncate text-sm font-semibold">{l.nom}</span>
          <span className="ml-2 shrink-0 text-xs text-[#5b6b62]">
            ×{l.qte} · {l.prix.toLocaleString("fr-FR")}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-lg bg-[#0f9d58]/10 px-3 py-2.5">
        <span className="text-sm font-bold">Total</span>
        <span className="text-lg font-extrabold text-[#0b5a38]">{total.toLocaleString("fr-FR")} FCFA</span>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {["Espèces", "Mobile Money", "Crédit"].map((mode, i) => (
          <span
            key={mode}
            className={cn(
              "rounded-lg px-2 py-2 text-center text-[11px] font-bold",
              i === 0 ? "bg-[#0f9d58] text-white" : "border border-[#e2e6df] text-[#5b6b62]"
            )}
          >
            {mode}
          </span>
        ))}
      </div>
    </div>
  );
}

function ApercuClients() {
  const clients = [
    { nom: "Mama Ngoua", segment: "Fidèle", ton: "#0f9d58", achats: 8, ca: 449000 },
    { nom: "Papa Obame", segment: "Fidèle", ton: "#0f9d58", achats: 6, ca: 536000 },
    { nom: "Chez Nadège", segment: "Récurrent", ton: "#2563eb", achats: 3, ca: 140000 },
    { nom: "J.-P. Ndong", segment: "Inactif", ton: "#d97706", achats: 4, ca: 204500 },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-[#5b6b62]">Vos clients</p>
      {clients.map((c, i) => (
        <div
          key={c.nom}
          className="flex items-center justify-between rounded-lg border border-[#e2e6df] px-3 py-2"
          style={{ animation: `slideIn .35s ease-out ${i * 70}ms both` }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{c.nom}</p>
            <span
              className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${c.ton}20`, color: c.ton }}
            >
              {c.segment}
            </span>
          </div>
          <div className="ml-2 shrink-0 text-right">
            <p className="text-sm font-extrabold">{c.ca.toLocaleString("fr-FR")}</p>
            <p className="text-[11px] text-[#5b6b62]">{c.achats} achats</p>
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
            className="rounded-lg border border-[#e2e6df] p-2"
            style={{ animation: `slideIn .35s ease-out ${i * 70}ms both` }}
          >
            <p className="text-[10px] text-[#5b6b62]">{k.label}</p>
            <p className="text-sm font-extrabold">{k.valeur}</p>
          </div>
        ))}
      </div>

      <div className="flex h-36 items-end justify-between gap-1.5 rounded-lg border border-[#e2e6df] p-3">
        {barres.map((b, i) => (
          <div key={b.jour} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[#0f9d58]"
              style={{ height: `${b.valeur}%`, animation: `growBar .5s ease-out ${i * 60}ms both` }}
            />
            <span className="text-[10px] text-[#5b6b62]">{b.jour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
