"use client";

// Liste des boutiques de la plateforme, avec recherche, filtre par formule et accès à la fiche.

import { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import { StoreDetailDialog } from "./store-detail-dialog";

export type BoutiqueLigne = {
  id: string;
  nom: string;
  ville: string | null;
  quartier: string | null;
  typeCommerce: string | null;
  plan: "ESSAI" | "PREMIUM" | "ENTREPRISE";
  programmeTest: boolean;
  devise: string;
  creeLe: string;
  essaiExpireLe: string | null;
  abonnementExpireLe: string | null;
  nbUtilisateurs: number;
  nbVentes: number;
  volume: number;
  derniereVente: string | null;
  derniereConnexion: string | null;
};

const TON_PLAN = { ESSAI: "warning", PREMIUM: "success", ENTREPRISE: "info" } as const;

function echeance(b: BoutiqueLigne): { texte: string; alerte: boolean } {
  const brut = b.plan === "ESSAI" ? b.essaiExpireLe : b.abonnementExpireLe;
  if (!brut) return { texte: "Sans échéance", alerte: false };
  const jours = differenceInCalendarDays(parseISO(brut), new Date());
  if (jours < 0) return { texte: `Expiré depuis ${-jours} j`, alerte: true };
  if (jours <= 7) return { texte: `Expire dans ${jours} j`, alerte: true };
  return { texte: `Jusqu'au ${format(parseISO(brut), "d MMM yyyy", { locale: fr })}`, alerte: false };
}

export function StoresTable({ planInitial = "TOUS" }: { planInitial?: string }) {
  const [boutiques, setBoutiques] = useState<BoutiqueLigne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState(planInitial);
  const [tri, setTri] = useState<"recent" | "volume" | "activite" | "nom">("recent");
  const [detailId, setDetailId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (plan !== "TOUS") params.set("plan", plan);
      const res = await fetch(`/api/superadmin/boutiques?${params.toString()}`);
      if (!res.ok) throw new Error("chargement");
      const data = await res.json();
      setBoutiques(data.boutiques ?? []);
    } catch {
      setErreur("Impossible de charger les boutiques.");
    } finally {
      setChargement(false);
    }
  }, [query, plan]);

  useEffect(() => {
    const timer = setTimeout(charger, 250);
    return () => clearTimeout(timer);
  }, [charger]);

  const triees = useMemo(() => {
    const copie = [...boutiques];
    copie.sort((a, b) => {
      if (tri === "nom") return a.nom.localeCompare(b.nom, "fr");
      if (tri === "volume") return b.volume - a.volume;
      if (tri === "activite") {
        const da = a.derniereVente ? parseISO(a.derniereVente).getTime() : 0;
        const db = b.derniereVente ? parseISO(b.derniereVente).getTime() : 0;
        return db - da;
      }
      return parseISO(b.creeLe).getTime() - parseISO(a.creeLe).getTime();
    });
    return copie;
  }, [boutiques, tri]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Boutiques</h1>
        <p className="text-sm text-muted-foreground">
          {boutiques.length} boutique{boutiques.length > 1 ? "s" : ""} — cliquez pour ouvrir la fiche et
          agir sur la formule.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une boutique (nom, ville, quartier)"
            className="pl-9"
          />
        </div>
        <Select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-auto" aria-label="Formule">
          <option value="TOUS">Toutes les formules</option>
          <option value="ESSAI">Essai</option>
          <option value="PREMIUM">Premium</option>
          <option value="ENTREPRISE">Entreprise</option>
        </Select>
        <Select
          value={tri}
          onChange={(e) => setTri(e.target.value as typeof tri)}
          className="w-auto"
          aria-label="Trier par"
        >
          <option value="recent">Trier : inscription récente</option>
          <option value="volume">Trier : volume encaissé</option>
          <option value="activite">Trier : activité récente</option>
          <option value="nom">Trier : nom</option>
        </Select>
      </div>

      {chargement ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : erreur ? (
        <p className="text-sm text-danger">{erreur}</p>
      ) : triees.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune boutique ne correspond à cette recherche.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Boutique</th>
                  <th className="px-4 py-2.5 font-bold">Formule</th>
                  <th className="px-4 py-2.5 font-bold">Échéance</th>
                  <th className="px-4 py-2.5 text-right font-bold">Équipe</th>
                  <th className="px-4 py-2.5 text-right font-bold">Ventes</th>
                  <th className="px-4 py-2.5 text-right font-bold">Volume</th>
                  <th className="px-4 py-2.5 font-bold">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {triees.map((b) => {
                  const ech = echeance(b);
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setDetailId(b.id)}
                      className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold">{b.nom}</p>
                        <p className="text-xs text-muted-foreground">
                          {[b.ville, b.quartier, b.typeCommerce].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TON_PLAN[b.plan]}>{b.plan}</Badge>
                        {b.programmeTest ? <Badge tone="info">testeur</Badge> : null}
                      </td>
                      <td className={`px-4 py-3 text-xs ${ech.alerte ? "font-bold text-danger" : "text-muted-foreground"}`}>
                        {ech.texte}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.nbUtilisateurs}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{b.nbVentes}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatFcfa(b.volume)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {b.derniereVente
                          ? format(parseISO(b.derniereVente), "d MMM yyyy", { locale: fr })
                          : "Aucune vente"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <StoreDetailDialog storeId={detailId} onClose={() => setDetailId(null)} onChanged={charger} />
    </div>
  );
}
