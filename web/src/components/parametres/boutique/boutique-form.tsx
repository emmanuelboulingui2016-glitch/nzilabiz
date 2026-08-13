"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Store as StoreIcon } from "lucide-react";
import { PAYS_OPTIONS, TYPE_COMMERCE_OPTIONS, indicatifForPays } from "./constants";

export type BoutiqueInitial = {
  nom: string;
  logoUrl: string | null;
  telephone: string | null;
  ville: string | null;
  pays: string;
  indicatif: string;
  typeCommerce: string | null;
  quartier: string | null;
  noteBasFacture: string | null;
};

export function BoutiqueForm({ initial }: { initial: BoutiqueInitial }) {
  const [nom, setNom] = useState(initial.nom);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [telephone, setTelephone] = useState(initial.telephone ?? "");
  const [ville, setVille] = useState(initial.ville ?? "");
  const [pays, setPays] = useState(initial.pays);
  const [indicatif, setIndicatif] = useState(initial.indicatif);
  const [typeCommerce, setTypeCommerce] = useState(initial.typeCommerce ?? "");
  const [quartier, setQuartier] = useState(initial.quartier ?? "");
  const [noteBasFacture, setNoteBasFacture] = useState(initial.noteBasFacture ?? "");
  const [saving, setSaving] = useState(false);

  const handlePaysChange = (value: string) => {
    setPays(value);
    setIndicatif(indicatifForPays(value));
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Le logo doit être une image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image est trop lourde (max 2 Mo).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/boutique", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom,
          logoUrl,
          telephone: telephone || null,
          ville: ville || null,
          pays,
          indicatif,
          typeCommerce: typeCommerce || null,
          quartier: quartier || null,
          noteBasFacture: noteBasFacture || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible d'enregistrer les modifications.");
        return;
      }
      toast.success("Boutique mise à jour.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-20 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {logoUrl ? (
              <Image src={logoUrl} alt="Logo de la boutique" width={64} height={64} className="h-full w-full object-cover" unoptimized />
            ) : (
              <StoreIcon size={24} className="text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">PNG ou JPG, 2 Mo maximum.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nom">Nom de la boutique</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} required minLength={2} />
          </div>

          <div>
            <Label htmlFor="telephone">Téléphone</Label>
            <div className="flex gap-2">
              <span className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground">
                {indicatif}
              </span>
              <Input
                id="telephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="06 12 34 56"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ville">Ville</Label>
            <Input id="ville" value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Libreville" />
          </div>

          <div>
            <Label htmlFor="pays">Pays</Label>
            <Select id="pays" value={pays} onChange={(e) => handlePaysChange(e.target.value)}>
              {PAYS_OPTIONS.map((p) => (
                <option key={p.nom} value={p.nom}>
                  {p.nom} ({p.indicatif})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="typeCommerce">Type de commerce</Label>
            <Select id="typeCommerce" value={typeCommerce} onChange={(e) => setTypeCommerce(e.target.value)}>
              <option value="">Non renseigné</option>
              {TYPE_COMMERCE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="quartier">Quartier / adresse</Label>
            <Input
              id="quartier"
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
              placeholder="Ex. Quartier Nzeng-Ayong, derrière la pharmacie du carrefour"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Texte libre — pas d&apos;adresse structurée, comme il est d&apos;usage au Gabon.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="noteBasFacture">Note de bas de facture</Label>
            <Textarea
              id="noteBasFacture"
              value={noteBasFacture}
              onChange={(e) => setNoteBasFacture(e.target.value)}
              placeholder="Ex. Merci de votre confiance ! Marchandise vendue non reprise."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
