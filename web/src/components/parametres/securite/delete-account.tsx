"use client";

// Zone de danger — suppression du compte.
//
// Le texte de confirmation diffère selon le rôle parce que la conséquence diffère : le Patron
// efface la boutique entière, un employé n'efface que son propre accès. On l'écrit noir sur
// blanc avant de laisser cliquer.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import type { Role } from "@/lib/auth/rbac";

export function DeleteAccount({
  role,
  storeName,
  aMotDePasse,
}: {
  role: Role;
  storeName: string;
  aMotDePasse: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  const estPatron = role === "PATRON";
  const attendu = estPatron ? storeName : "SUPPRIMER";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/parametres/compte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse: motDePasse || undefined, confirmation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Suppression impossible.");
        return;
      }
      toast.success(
        data.portee === "BOUTIQUE" ? "Boutique et compte supprimés." : "Votre compte a été supprimé."
      );
      router.push("/connexion");
      router.refresh();
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-danger/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle size={16} /> Supprimer mon compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {estPatron ? (
            <div className="space-y-2 text-sm">
              <p>
                Vous êtes le propriétaire de <strong>{storeName}</strong>. Supprimer votre compte supprime
                définitivement la boutique et <strong>toutes ses données</strong> :
              </p>
              <ul className="list-inside list-disc text-muted-foreground">
                <li>produits, stock et mouvements de stock</li>
                <li>ventes, factures, proformas et reçus</li>
                <li>clients, créances et remboursements</li>
                <li>dépenses et rapports</li>
                <li>comptes de vos employés (gérants et vendeurs)</li>
              </ul>
              <p className="font-semibold">
                Cette action est irréversible : aucune sauvegarde n&apos;est conservée de notre côté.
                Exportez vos rapports et votre liste de clients en CSV avant de continuer.
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                Votre accès à <strong>{storeName}</strong> sera supprimé et vos informations personnelles
                (nom, e-mail, photo) effacées. Vous ne pourrez plus vous connecter.
              </p>
              <p className="text-muted-foreground">
                Les ventes que vous avez enregistrées restent dans l&apos;historique de la boutique, sans
                votre nom : elles appartiennent à la comptabilité du commerçant, pas à votre compte.
              </p>
            </div>
          )}
          <Button variant="danger" onClick={() => setOpen(true)}>
            Supprimer mon compte
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="Confirmer la suppression">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {estPatron
              ? "La boutique et toutes ses données seront définitivement effacées."
              : "Votre compte sera définitivement supprimé."}{" "}
            Cette action ne peut pas être annulée.
          </p>

          {aMotDePasse ? (
            <div>
              <Label htmlFor="del-password">Votre mot de passe</Label>
              <Input
                id="del-password"
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="del-confirm">
              {estPatron ? (
                <>
                  Saisissez le nom exact de la boutique : <strong>{storeName}</strong>
                </>
              ) : (
                <>
                  Saisissez <strong>SUPPRIMER</strong> pour confirmer
                </>
              )}
            </Label>
            <Input
              id="del-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" variant="danger" disabled={busy || confirmation !== attendu}>
              {busy ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
