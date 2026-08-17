"use client";

// Invitations par QR code — le patron génère un lien, l'employé le scanne avec son téléphone et
// crée lui-même son mot de passe. Plus de mot de passe temporaire à dicter ou à noter sur un
// papier, et le lien expire tout seul.

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Copy, Link2, QrCode as QrIcon, Share2, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { QrCode } from "@/components/ui/qr-code";

type Invitation = {
  id: string;
  token: string;
  role: "GERANT" | "VENDEUR";
  nomPrevu: string | null;
  emailPrevu: string | null;
  etat: "ACTIVE" | "UTILISEE" | "EXPIREE" | "REVOQUEE";
  expireLe: string;
  utiliseLe: string | null;
  creeLe: string;
};

const TON_ETAT = {
  ACTIVE: "success",
  UTILISEE: "neutral",
  EXPIREE: "warning",
  REVOQUEE: "danger",
} as const;

const LABEL_ETAT = {
  ACTIVE: "En attente",
  UTILISEE: "Acceptée",
  EXPIREE: "Expirée",
  REVOQUEE: "Annulée",
} as const;

export function InvitationsPanel({ storeName }: { storeName: string }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [creation, setCreation] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [role, setRole] = useState<"GERANT" | "VENDEUR">("VENDEUR");
  const [nomPrevu, setNomPrevu] = useState("");
  const [emailPrevu, setEmailPrevu] = useState("");
  const [afficher, setAfficher] = useState<Invitation | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const res = await fetch("/api/parametres/invitations");
      if (!res.ok) throw new Error("chargement");
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      toast.error("Impossible de charger les invitations.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Construit dans le navigateur : le lien doit pointer vers l'adresse par laquelle l'employé
  // accédera réellement à l'application (adresse locale du réseau en développement, domaine en
  // production).
  const lien = (token: string) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/invitation/${token}`;

  async function creer() {
    setOccupe(true);
    try {
      const res = await fetch("/api/parametres/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          nomPrevu: nomPrevu.trim() || null,
          emailPrevu: emailPrevu.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Création impossible.");
        return;
      }
      setCreation(false);
      setNomPrevu("");
      setEmailPrevu("");
      setAfficher(data.invitation);
      charger();
    } finally {
      setOccupe(false);
    }
  }

  async function revoquer(id: string) {
    if (!window.confirm("Annuler cette invitation ? Le lien et le QR code ne fonctionneront plus.")) return;
    const res = await fetch(`/api/parametres/invitations?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Annulation impossible.");
      return;
    }
    toast.success("Invitation annulée.");
    charger();
  }

  async function copier(token: string) {
    try {
      await navigator.clipboard.writeText(lien(token));
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie impossible — sélectionnez le lien à la main.");
    }
  }

  function partagerWhatsapp(inv: Invitation) {
    const message =
      `Bonjour${inv.nomPrevu ? ` ${inv.nomPrevu}` : ""}, voici votre accès à la caisse de ${storeName} ` +
      `(rôle ${inv.role === "GERANT" ? "gérant" : "vendeur"}) : ${lien(inv.token)}\n` +
      `Ouvrez ce lien sur votre téléphone et choisissez votre mot de passe. Le lien expire le ` +
      `${format(parseISO(inv.expireLe), "d MMMM", { locale: fr })}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  const actives = invitations.filter((i) => i.etat === "ACTIVE");

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base font-bold text-foreground">Inviter par QR code</CardTitle>
          <p className="text-xs text-muted-foreground">
            L&apos;employé scanne le code avec son téléphone et choisit lui-même son mot de passe. Le lien
            expire au bout de 7 jours et ne sert qu&apos;une fois.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreation(true)}>
          <UserPlus size={16} /> Nouvelle invitation
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {chargement ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : invitations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Aucune invitation pour l&apos;instant. Créez-en une pour ajouter un vendeur ou un gérant.
          </p>
        ) : (
          invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {inv.nomPrevu || inv.emailPrevu || "Invitation sans nom"}
                  <Badge tone={TON_ETAT[inv.etat]}>{LABEL_ETAT[inv.etat]}</Badge>
                  <Badge tone="neutral">{inv.role === "GERANT" ? "Gérant" : "Vendeur"}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {inv.etat === "UTILISEE" && inv.utiliseLe
                    ? `Acceptée le ${format(parseISO(inv.utiliseLe), "d MMM yyyy", { locale: fr })}`
                    : `Valable jusqu'au ${format(parseISO(inv.expireLe), "d MMM yyyy", { locale: fr })}`}
                </p>
              </div>

              {inv.etat === "ACTIVE" ? (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setAfficher(inv)}>
                    <QrIcon size={15} /> QR code
                  </Button>
                  <button
                    onClick={() => copier(inv.token)}
                    aria-label="Copier le lien"
                    title="Copier le lien"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => revoquer(inv.id)}
                    aria-label="Annuler l'invitation"
                    title="Annuler l'invitation"
                    className="rounded-lg p-2 text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}

        {actives.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {actives.length} invitation{actives.length > 1 ? "s" : ""} en attente d&apos;acceptation.
          </p>
        ) : null}
      </CardContent>

      <Dialog open={creation} onClose={() => setCreation(false)} title="Nouvelle invitation">
        <div className="space-y-3">
          <div>
            <Label htmlFor="inv-role">Rôle</Label>
            <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="VENDEUR">Vendeur — caisse et ses propres ventes</option>
              <option value="GERANT">Gérant — gestion quotidienne complète</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="inv-nom">Nom de l&apos;employé (optionnel)</Label>
            <Input
              id="inv-nom"
              value={nomPrevu}
              onChange={(e) => setNomPrevu(e.target.value)}
              placeholder="Pour reconnaître l'invitation dans la liste"
            />
          </div>
          <div>
            <Label htmlFor="inv-email">Réserver à un e-mail (optionnel)</Label>
            <Input
              id="inv-email"
              type="email"
              value={emailPrevu}
              onChange={(e) => setEmailPrevu(e.target.value)}
              placeholder="employe@exemple.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si vous le renseignez, seule cette adresse pourra accepter l&apos;invitation.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setCreation(false)} disabled={occupe}>
              Annuler
            </Button>
            <Button onClick={creer} disabled={occupe}>
              {occupe ? "Création..." : "Générer le QR code"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={afficher !== null}
        onClose={() => setAfficher(null)}
        title="Invitation à scanner"
      >
        {afficher ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Faites scanner ce code par {afficher.nomPrevu || "votre employé"} avec l&apos;appareil photo
              de son téléphone.
            </p>

            <div className="flex justify-center">
              <QrCode valeur={lien(afficher.token)} taille={220} />
            </div>

            <div className="rounded-lg bg-muted p-3 text-left">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold">
                <Link2 size={13} /> Lien direct
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">{lien(afficher.token)}</p>
            </div>

            <p className="text-xs text-muted-foreground">
              Rôle : <strong>{afficher.role === "GERANT" ? "Gérant" : "Vendeur"}</strong> · Valable jusqu&apos;au{" "}
              {format(parseISO(afficher.expireLe), "d MMMM yyyy", { locale: fr })} · Usage unique
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => copier(afficher.token)}>
                <Copy size={15} /> Copier le lien
              </Button>
              <Button size="sm" onClick={() => partagerWhatsapp(afficher)}>
                <Share2 size={15} /> Envoyer par WhatsApp
              </Button>
            </div>

            <p className="rounded-lg bg-warning/10 p-2 text-xs text-warning">
              Ce lien vaut un accès à votre boutique tant qu&apos;il n&apos;a pas été utilisé : ne le
              diffusez pas publiquement.
            </p>
          </div>
        ) : null}
      </Dialog>
    </Card>
  );
}
