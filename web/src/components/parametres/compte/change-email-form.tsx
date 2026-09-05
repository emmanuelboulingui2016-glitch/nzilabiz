"use client";

// Changement de l'adresse e-mail de la boutique — un seul e-mail par boutique, celui du Patron.
// La nouvelle adresse ne remplace l'actuelle qu'une fois confirmée par e-mail : voir
// /api/parametres/compte/email et le commentaire sur `users.nouvelEmail` dans le schéma.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { InputMotDePasse } from "@/components/ui/input-mot-de-passe";

export function ChangeEmailForm({
  email,
  nouvelEmail,
  emailVerifie,
  aMotDePasse,
  envoiDisponible,
}: {
  email: string | null;
  nouvelEmail: string | null;
  emailVerifie: boolean;
  aMotDePasse: boolean;
  envoiDisponible: boolean;
}) {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState("");
  const [adresse, setAdresse] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAnnuler, setBusyAnnuler] = useState(false);
  const [busyRenvoyer, setBusyRenvoyer] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/parametres/compte/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse: motDePasse || undefined, nouvelEmail: adresse }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "La demande n'a pas abouti.");
        return;
      }
      toast.success(data.message ?? "Lien de confirmation envoyé.");
      setMotDePasse("");
      setAdresse("");
      router.refresh();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const annuler = async () => {
    setBusyAnnuler(true);
    try {
      const res = await fetch("/api/parametres/compte/email", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Impossible d'annuler.");
        return;
      }
      toast.success("Demande de changement annulée.");
      router.refresh();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setBusyAnnuler(false);
    }
  };

  const renvoyerVerification = async () => {
    setBusyRenvoyer(true);
    try {
      const res = await fetch("/api/auth/verifier-email/renvoyer", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "L'envoi a échoué.");
        return;
      }
      toast.success(
        data.dejaVerifiee
          ? "Votre adresse est déjà vérifiée."
          : "E-mail de confirmation renvoyé — pensez à vérifier vos indésirables."
      );
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setBusyRenvoyer(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail size={16} /> Adresse e-mail de la boutique
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Adresse actuelle :</span>
          <span className="font-semibold">{email ?? "—"}</span>
          {emailVerifie ? (
            <Badge tone="success">
              <CheckCircle2 size={12} /> Vérifiée
            </Badge>
          ) : (
            <Badge tone="warning">
              <TriangleAlert size={12} /> Non vérifiée
            </Badge>
          )}
        </div>

        {!emailVerifie && envoiDisponible ? (
          <Button type="button" variant="outline" size="sm" onClick={renvoyerVerification} disabled={busyRenvoyer}>
            {busyRenvoyer ? "Envoi…" : "Renvoyer le lien de vérification"}
          </Button>
        ) : null}

        {nouvelEmail ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <p>
              Une confirmation est en attente vers <strong>{nouvelEmail}</strong>. Votre adresse actuelle reste
              active tant qu&apos;elle n&apos;est pas confirmée.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={annuler}
              disabled={busyAnnuler}
            >
              {busyAnnuler ? "Annulation…" : "Annuler cette demande"}
            </Button>
          </div>
        ) : null}

        {envoiDisponible ? (
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {aMotDePasse ? (
              <div className="sm:col-span-2">
                <Label htmlFor="email-password">Mot de passe actuel</Label>
                <InputMotDePasse
                  id="email-password"
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Label htmlFor="email-nouvelle">Nouvelle adresse e-mail</Label>
              <Input
                id="email-nouvelle"
                type="email"
                autoComplete="email"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Envoi…" : "Changer d'adresse"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            Le changement d&apos;adresse nécessite l&apos;envoi d&apos;un e-mail de confirmation, indisponible
            pour le moment. Contactez le support pour corriger votre adresse.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
