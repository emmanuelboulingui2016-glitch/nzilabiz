"use client";

// Réglages de la plateforme — le formulaire qui évite de repasser par le code pour changer un
// numéro de support ou compléter les mentions légales.

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Megaphone, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

type Reglages = Record<string, string | boolean | null>;

const CHAMPS_SUPPORT: { cle: string; label: string; aide?: string; placeholder?: string }[] = [
  { cle: "supportTelephone", label: "Téléphone du support", placeholder: "+241 07 00 00 00" },
  {
    cle: "supportWhatsapp",
    label: "Numéro WhatsApp du support",
    aide: "Indicatif compris. C'est ce numéro qu'ouvre le bouton d'aide dans l'application.",
    placeholder: "24107000000",
  },
  { cle: "supportEmail", label: "E-mail du support", placeholder: "contact@nzilabiz.com" },
  { cle: "supportHoraires", label: "Horaires du support", placeholder: "Lundi à samedi, 8h – 18h" },
];

const CHAMPS_EDITEUR: { cle: string; label: string; placeholder?: string }[] = [
  { cle: "editeurRaisonSociale", label: "Raison sociale", placeholder: "NzilaBiz SARL" },
  { cle: "editeurFormeJuridique", label: "Forme juridique et capital", placeholder: "SARL au capital de 1 000 000 FCFA" },
  { cle: "editeurAdresse", label: "Siège social", placeholder: "Quartier Louis, Libreville, Gabon" },
  { cle: "editeurImmatriculation", label: "Numéro d'immatriculation", placeholder: "RCCM GA-LBV-..." },
  { cle: "editeurDirecteurPublication", label: "Directeur de la publication", placeholder: "Nom et prénom" },
];

const CHAMPS_HEBERGEUR: { cle: string; label: string; placeholder?: string }[] = [
  { cle: "hebergeurNom", label: "Hébergeur", placeholder: "Nom de l'hébergeur" },
  { cle: "hebergeurAdresse", label: "Adresse de l'hébergeur" },
  { cle: "hebergeurPays", label: "Pays d'hébergement des données", placeholder: "France" },
];

const CHAMPS_JURIDIQUE: { cle: string; label: string; placeholder?: string }[] = [
  { cle: "droitApplicable", label: "Droit applicable", placeholder: "gabonais" },
  { cle: "juridictionCompetente", label: "Juridiction compétente", placeholder: "Tribunal de commerce de Libreville" },
  {
    cle: "autoriteProtectionDonnees",
    label: "Autorité de protection des données",
    placeholder: "CNPDCP (Gabon)",
  },
];

const CHAMPS_RESEAUX: { cle: string; label: string; placeholder?: string }[] = [
  { cle: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/..." },
  { cle: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/..." },
  { cle: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@..." },
];

export function PlatformSettingsForm() {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    fetch("/api/superadmin/reglages")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then((data) => setReglages(data.reglages))
      .catch(() => toast.error("Impossible de charger les réglages."));
  }, []);

  const set = (cle: string, valeur: string | boolean) =>
    setReglages((r) => (r ? { ...r, [cle]: valeur } : r));

  const champ = (cle: string) => (reglages?.[cle] as string | null) ?? "";

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (!reglages) return;
    setEnregistrement(true);
    try {
      const res = await fetch("/api/superadmin/reglages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomApplication: champ("nomApplication") || "NzilaBiz",
          slogan: champ("slogan") || "Gérez votre boutique, simplement, au quotidien",
          annonceActive: Boolean(reglages.annonceActive),
          ...Object.fromEntries(
            [
              ...CHAMPS_SUPPORT,
              ...CHAMPS_EDITEUR,
              ...CHAMPS_HEBERGEUR,
              ...CHAMPS_JURIDIQUE,
              ...CHAMPS_RESEAUX,
            ].map((c) => [c.cle, champ(c.cle) || null])
          ),
          annonce: champ("annonce") || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      setReglages(data.reglages);
      toast.success("Réglages publiés — le site public est à jour.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setEnregistrement(false);
    }
  }

  if (!reglages) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  const bloc = (
    titre: string,
    description: string,
    champs: { cle: string; label: string; aide?: string; placeholder?: string }[]
  ) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-bold text-foreground">{titre}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {champs.map((c) => (
          <div key={c.cle}>
            <Label htmlFor={`pf-${c.cle}`}>{c.label}</Label>
            <Input
              id={`pf-${c.cle}`}
              value={champ(c.cle)}
              onChange={(e) => set(c.cle, e.target.value)}
              placeholder={c.placeholder}
            />
            {c.aide ? <p className="mt-1 text-xs text-muted-foreground">{c.aide}</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Réglages de la plateforme</h1>
          <p className="text-sm text-muted-foreground">
            Ces informations alimentent le site public, les mentions légales et l&apos;aide dans
            l&apos;application. Aucun passage par le code.
          </p>
        </div>
        <Button type="submit" disabled={enregistrement}>
          <Save size={16} />
          {enregistrement ? "Publication..." : "Publier"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-foreground">Identité</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pf-nom">Nom de l&apos;application</Label>
            <Input id="pf-nom" value={champ("nomApplication")} onChange={(e) => set("nomApplication", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pf-slogan">Slogan</Label>
            <Input id="pf-slogan" value={champ("slogan")} onChange={(e) => set("slogan", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className={reglages.annonceActive ? "border-primary/40" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Megaphone size={16} /> Annonce dans l&apos;application
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Affichée en bandeau à tous les commerçants connectés — maintenance prévue, nouveauté,
            rappel d&apos;échéance.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={champ("annonce")}
            onChange={(e) => set("annonce", e.target.value)}
            placeholder="Ex. : maintenance prévue dimanche de 22h à 23h, l'application restera utilisable hors connexion."
          />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={Boolean(reglages.annonceActive)}
              onChange={(e) => set("annonceActive", e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Afficher cette annonce maintenant
          </label>
        </CardContent>
      </Card>

      {bloc("Support", "Coordonnées visibles par les commerçants et sur le site public.", CHAMPS_SUPPORT)}
      {bloc("Éditeur", "Apparaît dans les mentions légales et les conditions d'utilisation.", CHAMPS_EDITEUR)}
      {bloc("Hébergement", "Apparaît dans les mentions légales et la politique de confidentialité.", CHAMPS_HEBERGEUR)}
      {bloc("Cadre juridique", "Droit applicable, tribunal compétent, autorité de contrôle.", CHAMPS_JURIDIQUE)}
      {bloc("Réseaux sociaux", "Liens affichés dans le pied de page du site public.", CHAMPS_RESEAUX)}

      <div className="flex justify-end">
        <Button type="submit" disabled={enregistrement}>
          <Save size={16} />
          {enregistrement ? "Publication..." : "Publier"}
        </Button>
      </div>
    </form>
  );
}
