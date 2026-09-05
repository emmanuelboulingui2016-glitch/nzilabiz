"use client";

// Grille tarifaire — le seul endroit où l'on fixe le prix des formules Essentiel et Premium.
//
// Les montants vivaient en dur dans le code, en double exemplaire : la page tarifs publique et
// l'écran Abonnement pouvaient afficher deux prix différents, et une remise demandait un
// déploiement. Ce formulaire écrit en base ; les deux écrans lisent la même ligne.
//
// Entreprise n'a plus sa place ici : son prix n'est plus public, il se négocie boutique par
// boutique et se fixe depuis la fiche de la boutique concernée (section « Formule Entreprise »).
// Un champ « tarif Entreprise » resté dans ce formulaire aurait continué d'écrire en base sans
// plus jamais s'afficher nulle part — un piège pour la prochaine personne qui le retrouverait et
// le remplirait en pensant qu'il sert à quelque chose. La route API refuse d'ailleurs désormais
// toute écriture avec `plan: "ENTREPRISE"`, même si ce formulaire ne peut plus en envoyer.

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { RotateCcw, Save, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";

const PLANS = ["ESSENTIEL", "PREMIUM"] as const;
const CYCLES = ["mensuel", "trimestriel", "annuel"] as const;

type Plan = (typeof PLANS)[number];
type Cycle = (typeof CYCLES)[number];
/** La grille reçue de l'API porte encore la clé ENTREPRISE (toujours vide) : on ne la lit pas ici. */
type Grille = Record<Plan, Partial<Record<Cycle, number>>> & { ENTREPRISE?: Partial<Record<Cycle, number>> };

const LIBELLE_PLAN: Record<Plan, string> = {
  ESSENTIEL: "Essentiel",
  PREMIUM: "Premium",
};

const LIBELLE_CYCLE: Record<Cycle, string> = {
  mensuel: "Par mois",
  trimestriel: "Par trimestre",
  annuel: "Par an",
};

const AIDE_PLAN: Record<Plan, string> = {
  ESSENTIEL: "Caisse, stock, clients et créances. Jusqu'à 3 comptes.",
  PREMIUM: "Toutes les fonctionnalités, comptes illimités.",
};

export function TarifsForm() {
  const [grille, setGrille] = useState<Grille | null>(null);
  const [defauts, setDefauts] = useState<Grille | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/tarifs")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then((data) => {
        setGrille(data.tarifs);
        setDefauts(data.defauts);
      })
      .catch(() => toast.error("Impossible de charger la grille tarifaire."));
  }, []);

  const valeur = (plan: Plan, cycle: Cycle) => {
    const v = grille?.[plan]?.[cycle];
    return v === undefined || v === null ? "" : String(v);
  };

  function set(plan: Plan, cycle: Cycle, brut: string) {
    setGrille((g) => {
      if (!g) return g;
      const chiffres = brut.replace(/[^\d]/g, "");
      const suivant = { ...g, [plan]: { ...g[plan] } };
      if (chiffres === "") delete suivant[plan][cycle];
      else suivant[plan][cycle] = Number(chiffres);
      return suivant;
    });
  }

  function reinitialiser() {
    if (!defauts) return;
    setGrille({
      ESSENTIEL: { ...defauts.ESSENTIEL },
      PREMIUM: { ...defauts.PREMIUM },
      ENTREPRISE: { ...defauts.ENTREPRISE },
    });
    toast.info("Tarifs d'origine rétablis — enregistrez pour les publier.");
  }

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (!grille) return;
    setEnregistrement(true);
    try {
      // Un champ vidé est envoyé à `null` : la ligne est supprimée et le tarif d'origine reprend
      // la main. C'est la façon de revenir en arrière sans avoir à retrouver le montant.
      const tarifs = PLANS.flatMap((plan) =>
        CYCLES.map((cycle) => ({
          plan,
          cycle,
          montant: grille[plan]?.[cycle] ?? null,
        }))
      );

      const res = await fetch("/api/superadmin/tarifs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarifs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      setGrille(data.tarifs);
      toast.success("Tarifs publiés — la page tarifs et l'écran Abonnement sont à jour.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setEnregistrement(false);
    }
  }

  if (!grille) return <p className="text-sm text-muted-foreground">Chargement de la grille...</p>;

  return (
    <form onSubmit={enregistrer}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Tag size={16} className="text-primary" />
            Tarifs des formules
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Montants en FCFA. Ils s&apos;appliquent immédiatement à la page tarifs du site et à
            l&apos;écran Abonnement. Un champ laissé vide masque ce cycle pour cette formule.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <p className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            La formule Entreprise n&apos;a pas de tarif public : elle se négocie boutique par
            boutique, depuis la fiche de la boutique concernée (section « Formule Entreprise »).
          </p>

          {PLANS.map((plan) => (
            <div key={plan} className="rounded-lg border border-border p-4">
              <p className="text-sm font-bold">{LIBELLE_PLAN[plan]}</p>
              <p className="mb-3 text-xs text-muted-foreground">{AIDE_PLAN[plan]}</p>

              <div className="grid gap-4 sm:grid-cols-3">
                {CYCLES.map((cycle) => {
                  const brut = valeur(plan, cycle);
                  const montant = Number(brut);
                  return (
                    <div key={cycle}>
                      <Label htmlFor={`tarif-${plan}-${cycle}`}>{LIBELLE_CYCLE[cycle]}</Label>
                      <Input
                        id={`tarif-${plan}-${cycle}`}
                        inputMode="numeric"
                        value={brut}
                        onChange={(e) => set(plan, cycle, e.target.value)}
                        placeholder="—"
                      />
                      <p className="mt-1 h-4 text-xs text-muted-foreground">
                        {brut && montant > 0 ? formatFcfa(montant) : "non proposé"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={enregistrement}>
              <Save size={16} />
              {enregistrement ? "Enregistrement..." : "Publier les tarifs"}
            </Button>
            <Button type="button" variant="outline" onClick={reinitialiser} disabled={enregistrement}>
              <RotateCcw size={16} />
              Rétablir les tarifs d&apos;origine
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
