"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Building2, Check, Loader2, Plus, Store, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, Input, Label } from "@/components/ui";
import { ContactSupport } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { formatFcfa } from "@/lib/currency";
import { cn } from "@/lib/utils";

export type ChiffresBoutique = { caJour: number; ventesJour: number; caMois: number; stockBas: number };

export type BoutiqueLigne = {
  id: string;
  nom: string;
  role: "PATRON" | "GERANT" | "VENDEUR";
  active: boolean;
  maisonMere: boolean;
  chiffres: ChiffresBoutique;
};

const AVANTAGES = [
  "Plusieurs boutiques sous un seul compte",
  "Chiffres consolidés : le total du réseau et le détail de chaque boutique",
  "Bascule d'une boutique à l'autre sans se reconnecter",
  "Un seul abonnement pour tout le réseau",
  "Utilisateurs illimités, support dédié",
];

export function ReseauView({
  plan,
  entreprise,
  peutAjouter,
  maximum,
  boutiques,
  contact,
}: {
  plan: string;
  entreprise: boolean;
  peutAjouter: boolean;
  maximum: number;
  boutiques: BoutiqueLigne[];
  contact: ContactCommercial;
}) {
  const router = useRouter();
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [bascule, setBascule] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const total = boutiques.reduce(
    (acc, b) => ({
      caJour: acc.caJour + b.chiffres.caJour,
      ventesJour: acc.ventesJour + b.chiffres.ventesJour,
      caMois: acc.caMois + b.chiffres.caMois,
      stockBas: acc.stockBas + b.chiffres.stockBas,
    }),
    { caJour: 0, ventesJour: 0, caMois: 0, stockBas: 0 }
  );

  async function creer() {
    if (!nom.trim() || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch("/api/boutiques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), ville: ville.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErreur(data?.error ?? "Création impossible.");
        setEnCours(false);
        return;
      }
      setAjoutOuvert(false);
      setNom("");
      setVille("");
      setEnCours(false);
      router.refresh();
    } catch {
      setErreur("Vous semblez hors connexion. La création d'une boutique demande le réseau.");
      setEnCours(false);
    }
  }

  async function basculer(id: string) {
    if (bascule) return;
    setBascule(id);
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
        setBascule(null);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErreur("Vous semblez hors connexion. Réessayez une fois le réseau revenu.");
      setBascule(null);
    }
  }

  const reseau = boutiques.length > 1;

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Building2 size={20} className="text-primary" />
            Mes boutiques
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {reseau
              ? `${boutiques.length} boutiques sous votre compte, un seul abonnement.`
              : "Une boutique aujourd'hui. La formule Entreprise permet d'en gérer plusieurs."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={entreprise ? "info" : "warning"}>{entreprise ? "Entreprise" : plan}</Badge>
          {peutAjouter ? (
            <Button size="sm" onClick={() => setAjoutOuvert(true)}>
              <Plus size={16} />
              Ajouter une boutique
            </Button>
          ) : null}
        </div>
      </div>

      {erreur && !ajoutOuvert ? (
        <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{erreur}</p>
      ) : null}

      {/* Total du réseau — la raison d'être de la formule : un chiffre unique pour l'ensemble.
          Sur une boutique seule, il ferait double emploi avec le tableau de bord. */}
      {reseau ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total du réseau</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Chiffre libelle="CA du jour" valeur={formatFcfa(total.caJour)} />
            <Chiffre libelle="Ventes du jour" valeur={String(total.ventesJour)} />
            <Chiffre libelle="CA du mois" valeur={formatFcfa(total.caMois)} />
            <Chiffre
              libelle="Produits en alerte"
              valeur={String(total.stockBas)}
              ton={total.stockBas > 0 ? "warning" : undefined}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {boutiques.map((b) => (
          <Card key={b.id} className={cn(b.active && "ring-2 ring-primary")}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{b.nom}</CardTitle>
                {b.active ? (
                  <Badge tone="success" className="text-xs">
                    Boutique ouverte
                  </Badge>
                ) : null}
                {reseau && b.maisonMere ? (
                  <Badge tone="info" className="text-xs">
                    Maison mère
                  </Badge>
                ) : null}
                {b.role !== "PATRON" ? <Badge className="text-xs">{b.role}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Chiffre libelle="CA du jour" valeur={formatFcfa(b.chiffres.caJour)} />
                <Chiffre libelle="Ventes" valeur={String(b.chiffres.ventesJour)} />
                <Chiffre libelle="CA du mois" valeur={formatFcfa(b.chiffres.caMois)} />
              </div>
              {b.chiffres.stockBas > 0 ? (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <TriangleAlert size={13} />
                  {b.chiffres.stockBas} produit{b.chiffres.stockBas > 1 ? "s" : ""} sous le seuil d&apos;alerte
                </p>
              ) : null}
              {b.active ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check size={13} className="text-primary" />
                  C&apos;est la boutique que vous êtes en train d&apos;utiliser.
                </p>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bascule !== null}
                  onClick={() => basculer(b.id)}
                  className="w-full"
                >
                  {bascule === b.id ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />}
                  Travailler dans cette boutique
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Présentation de la formule pour qui ne l'a pas — et rappel de la limite pour qui l'a. */}
      {!entreprise ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Passer à la formule Entreprise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5 text-sm">
              {AVANTAGES.map((a) => (
                <li key={a} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                  {a}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Tarif sur devis, selon le nombre de boutiques. Nous activons votre réseau dans la journée.
            </p>
            <ContactSupport contact={contact} sujet="Demande de formule Entreprise" />
          </CardContent>
        </Card>
      ) : boutiques.length >= maximum ? (
        <p className="text-sm text-muted-foreground">
          Votre réseau atteint la limite de {maximum} boutiques. Contactez le support pour l&apos;étendre.
        </p>
      ) : null}

      <Dialog open={ajoutOuvert} onClose={() => setAjoutOuvert(false)} title="Ajouter une boutique">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            La nouvelle boutique démarre vide, avec son propre stock, ses clients et ses ventes. Elle partage
            votre abonnement, votre pays et votre devise. Une fois basculé dedans, vous pourrez lui appliquer
            un catalogue de démarrage depuis l&apos;écran d&apos;accueil.
          </p>
          <div>
            <Label htmlFor="nouvelle-boutique">Nom de la boutique</Label>
            <Input
              id="nouvelle-boutique"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. : Alimentation Nzeng-Ayong"
              maxLength={80}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="nouvelle-boutique-ville">Ville ou quartier (facultatif)</Label>
            <Input
              id="nouvelle-boutique-ville"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Libreville"
              maxLength={80}
            />
          </div>
          {erreur ? <p className="text-sm text-danger">{erreur}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAjoutOuvert(false)} disabled={enCours}>
              Annuler
            </Button>
            <Button onClick={creer} disabled={enCours || nom.trim().length < 2}>
              {enCours ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
              Créer la boutique
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function Chiffre({ libelle, valeur, ton }: { libelle: string; valeur: string; ton?: "warning" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{libelle}</p>
      <p className={cn("mt-0.5 text-lg font-bold", ton === "warning" && "text-warning")}>{valeur}</p>
    </div>
  );
}
