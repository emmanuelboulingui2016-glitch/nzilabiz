"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import type { BoutiqueInitial } from "@/components/parametres/boutique/boutique-form";

// Article factice, uniquement pour donner un rendu réaliste à l'aperçu — n'est jamais envoyé au serveur.
const APERCU_ARTICLES = [
  { nom: "Riz (sac 25kg)", qte: 1, prix: 18000 },
  { nom: "Huile végétale 1L", qte: 2, prix: 1500 },
  { nom: "Eau minérale 1.5L", qte: 3, prix: 500 },
];

export function ReceiptPreview({ initial }: { initial: BoutiqueInitial }) {
  const [noteBasFacture, setNoteBasFacture] = useState(initial.noteBasFacture ?? "");
  const [saving, setSaving] = useState(false);

  const total = APERCU_ARTICLES.reduce((sum, a) => sum + a.qte * a.prix, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/parametres/boutique", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: initial.nom,
          logoUrl: initial.logoUrl,
          telephone: initial.telephone,
          ville: initial.ville,
          pays: initial.pays,
          indicatif: initial.indicatif,
          typeCommerce: initial.typeCommerce,
          quartier: initial.quartier,
          noteBasFacture: noteBasFacture || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible d'enregistrer la note.");
        return;
      }
      toast.success("Note de bas de reçu mise à jour.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 pb-20 md:grid-cols-2 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>Apparence du reçu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le logo, le téléphone, la ville/pays et le quartier/adresse affichés sur le reçu sont les
            mêmes que ceux renseignés dans l&apos;onglet{" "}
            <Link href="/parametres/boutique" className="font-medium text-primary underline underline-offset-2">
              Boutique
            </Link>
            .
          </p>

          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="noteBasFacture">Note de bas de reçu</Label>
            <Textarea
              id="noteBasFacture"
              value={noteBasFacture}
              onChange={(e) => setNoteBasFacture(e.target.value)}
              placeholder="Ex. Merci de votre confiance ! Marchandise vendue non reprise."
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer la note"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aperçu en direct</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mx-auto w-full max-w-xs rounded-lg border border-dashed border-border bg-background p-4 font-mono text-xs leading-relaxed">
            <div className="flex flex-col items-center text-center">
              {initial.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={initial.logoUrl} alt="Logo" className="mb-2 h-10 w-10 rounded object-cover" />
              ) : null}
              <p className="font-bold uppercase">{initial.nom || "Nom de la boutique"}</p>
              {initial.quartier ? <p>{initial.quartier}</p> : null}
              {(initial.ville || initial.pays) && (
                <p>
                  {[initial.ville, initial.pays].filter(Boolean).join(", ")}
                </p>
              )}
              {initial.telephone ? (
                <p>
                  Tél : {initial.indicatif} {initial.telephone}
                </p>
              ) : null}
            </div>

            <div className="my-2 border-t border-dashed border-border" />

            <div className="space-y-1">
              {APERCU_ARTICLES.map((a) => (
                <div key={a.nom} className="flex justify-between gap-2">
                  <span className="flex-1">
                    {a.nom} x{a.qte}
                  </span>
                  <span>{formatFcfa(a.qte * a.prix)}</span>
                </div>
              ))}
            </div>

            <div className="my-2 border-t border-dashed border-border" />

            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{formatFcfa(total)}</span>
            </div>

            <div className="my-2 border-t border-dashed border-border" />

            <p className="text-center text-[11px]">{noteBasFacture || "Merci de votre achat !"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
