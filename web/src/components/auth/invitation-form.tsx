"use client";

// Acceptation d'une invitation : l'employé choisit son mot de passe et entre directement dans la
// boutique. Aucune étape de validation supplémentaire — le patron a déjà décidé en générant le
// code, en rajouter une ferait perdre l'intérêt du QR.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Invitation = {
  role: "GERANT" | "VENDEUR";
  nomPrevu: string | null;
  telephonePrevu: string | null;
  expireLe: string;
  boutique: string;
};

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [erreurJeton, setErreurJeton] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErreurJeton(data.error ?? "Cette invitation n'est plus valable.");
          return;
        }
        setInvitation(data.invitation);
        setNom(data.invitation.nomPrevu ?? "");
        setTelephone(data.invitation.telephonePrevu ?? "");
      })
      .catch(() => setErreurJeton("Impossible de vérifier cette invitation."));
  }, [token]);

  async function accepter(e: FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, telephone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de créer le compte.");
        return;
      }
      toast.success("Bienvenue ! Votre compte est prêt.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (erreurJeton) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-bold">Invitation non valable</h2>
        <p className="text-sm text-muted-foreground">{erreurJeton}</p>
        <p className="text-sm text-muted-foreground">
          Demandez à votre patron de vous en générer une nouvelle depuis Paramètres → Utilisateurs.
        </p>
        <Link href="/connexion" className="inline-block text-sm font-semibold text-primary hover:underline">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  if (!invitation) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Vérification de l&apos;invitation...</p>;
  }

  return (
    <form onSubmit={accepter} className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold">Rejoindre {invitation.boutique}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous êtes invité comme{" "}
          <strong>{invitation.role === "GERANT" ? "gérant" : "vendeur"}</strong>. Choisissez votre mot de
          passe pour commencer.
        </p>
      </div>

      <div>
        <Label htmlFor="inv-nom">Votre nom</Label>
        <Input id="inv-nom" value={nom} onChange={(e) => setNom(e.target.value)} required minLength={2} />
      </div>

      <div>
        <Label htmlFor="inv-telephone">Votre numéro de téléphone</Label>
        <Input
          id="inv-telephone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="07 00 00 00"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          required
          readOnly={Boolean(invitation.telephonePrevu)}
          className={invitation.telephonePrevu ? "bg-muted" : undefined}
        />
        {invitation.telephonePrevu ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Cette invitation est réservée à ce numéro.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            C&apos;est avec ce numéro que vous vous connecterez.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="inv-password">Choisissez un mot de passe</Label>
        <Input
          id="inv-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-muted-foreground">6 caractères minimum.</p>
      </div>

      <Button type="submit" className="w-full" disabled={envoi}>
        {envoi ? "Création du compte..." : "Rejoindre la boutique"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        En continuant, vous acceptez les{" "}
        <Link href="/conditions" className="font-semibold text-primary hover:underline">
          conditions d&apos;utilisation
        </Link>
        .
      </p>
    </form>
  );
}
