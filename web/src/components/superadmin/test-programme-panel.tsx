"use client";

// Programme de test — le lien unique distribué aux testeurs pendant l'ouverture restreinte.
//
// Tout est modifiable sans redéploiement : activer, prolonger, ou changer le code si le lien a
// fuité. Le QR code permet de le partager de vive voix, en réunion ou sur un flyer.

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Check, Copy, FlaskConical, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { QrCode } from "@/components/ui/qr-code";

type Etat = {
  code: string | null;
  actif: boolean;
  expireLe: string | null;
  lien: string | null;
  boutiquesTesteuses: number;
  boutiquesTotal: number;
};

/** `<input type="date">` attend AAAA-MM-JJ ; une date ISO complète y est refusée en silence. */
const enJour = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function TestProgrammePanel() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [jour, setJour] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    const res = await fetch("/api/superadmin/programme-test");
    if (!res.ok) return;
    const data: Etat = await res.json();
    setEtat(data);
    setJour(enJour(data.expireLe));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function enregistrer(champs: { actif?: boolean; regenerer?: boolean }) {
    if (!etat) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/superadmin/programme-test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actif: champs.actif ?? etat.actif,
          regenerer: champs.regenerer ?? false,
          // Fin de journée : un testeur qui ouvre le lien le dernier jour à 18 h doit encore entrer.
          expireLe: jour ? new Date(`${jour}T23:59:59`).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Enregistrement impossible.");
        return;
      }
      setEtat(data);
      setJour(enJour(data.expireLe));
      toast.success(champs.regenerer ? "Nouveau code généré — l'ancien lien ne marche plus." : "Programme de test mis à jour.");
    } finally {
      setEnvoi(false);
    }
  }

  async function copier() {
    if (!etat?.lien) return;
    try {
      await navigator.clipboard.writeText(etat.lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez le lien à la main.");
    }
  }

  if (!etat) return null;

  const expire = etat.expireLe ? parseISO(etat.expireLe) : null;
  const termine = expire !== null && expire.getTime() < Date.now();
  const ouvert = etat.actif && !termine;
  const joursRestants = expire ? Math.ceil((expire.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <FlaskConical size={16} /> Programme de test
          <Badge tone={ouvert ? "success" : "neutral"}>{ouvert ? "ouvert" : termine ? "terminé" : "fermé"}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Un lien unique à partager aux testeurs. Chacun crée sa boutique et accède à tous les
          modules, sans payer, jusqu&apos;à la date de fin.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {ouvert && etat.lien ? <QrCode valeur={etat.lien} taille={150} /> : null}

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <Label>Lien à partager</Label>
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 flex-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                  {etat.lien ?? "aucun code généré"}
                </p>
                <Button size="sm" variant="ghost" onClick={copier} aria-label="Copier le lien" disabled={!etat.lien}>
                  {copie ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="test-fin">Ouvert jusqu&apos;au</Label>
              <Input id="test-fin" type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                {expire
                  ? termine
                    ? `Terminé depuis le ${format(expire, "d MMMM yyyy", { locale: fr })}.`
                    : `${joursRestants} jour(s) restant(s).`
                  : "Sans date, le lien reste ouvert indéfiniment."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => enregistrer({})} disabled={envoi}>
                Enregistrer
              </Button>
              <Button size="sm" variant="outline" onClick={() => enregistrer({ actif: !etat.actif })} disabled={envoi}>
                {etat.actif ? "Fermer le programme" : "Ouvrir le programme"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => enregistrer({ regenerer: true })}
                disabled={envoi}
                title="Utile si le lien a circulé plus loin que prévu"
              >
                <RefreshCw size={14} /> Nouveau code
              </Button>
            </div>
          </div>
        </div>

        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">{etat.boutiquesTesteuses}</strong> boutique(s) entrée(s)
          par ce lien, sur {etat.boutiquesTotal} au total. Changer le code coupe immédiatement
          l&apos;ancien lien, sans toucher aux boutiques déjà créées.
        </p>
      </CardContent>
    </Card>
  );
}
