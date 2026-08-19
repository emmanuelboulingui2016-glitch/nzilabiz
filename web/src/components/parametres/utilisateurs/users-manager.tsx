"use client";

import { useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";

export type Role = "PATRON" | "GERANT" | "VENDEUR";

export type StoreUser = {
  id: string;
  nom: string;
  email: string;
  role: Role;
  derniereConnexion: string | null;
  creeLe: string;
  aMotDePasse: boolean;
  googleId: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  PATRON: "Patron",
  GERANT: "Gérant",
  VENDEUR: "Vendeur",
};

const ROLE_TONE: Record<Role, "info" | "success" | "neutral"> = {
  PATRON: "info",
  GERANT: "success",
  VENDEUR: "neutral",
};

export function UsersManager({
  currentUserId,
  initialUsers,
}: {
  currentUserId: string;
  initialUsers: StoreUser[];
}) {
  const [list, setList] = useState<StoreUser[]>(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [tempCred, setTempCred] = useState<{ email: string; password: string } | null>(null);

  // Réinitialisation du mot de passe d'un employé. Sans envoi d'e-mail dans le service, c'est le
  // seul recours quand un vendeur oublie le sien : le Patron lui remet le nouveau de vive voix.
  async function reinitialiserMotDePasse(user: StoreUser) {
    if (!confirm(`Générer un nouveau mot de passe pour ${user.nom} ? L'ancien cessera aussitôt de fonctionner.`)) return;
    setResetId(user.id);
    try {
      const res = await fetch(`/api/parametres/utilisateurs/${user.id}/mot-de-passe`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Réinitialisation impossible.");
        return;
      }
      setTempCred({ email: user.email, password: data.tempPassword });
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setResetId(null);
    }
  }

  // -- Invitation --------------------------------------------------------
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VENDEUR");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/parametres/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de créer cet utilisateur.");
        return;
      }
      setList((prev) => [...prev, data.user]);
      setInviteOpen(false);
      setTempCred({ email: data.user.email, password: data.tempPassword });
      setNom("");
      setEmail("");
      setRole("VENDEUR");
      toast.success("Employé créé. Communiquez-lui le mot de passe temporaire affiché.");
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setInviting(false);
    }
  };

  // -- Changement de rôle --------------------------------------------------
  const changeRole = async (user: StoreUser, newRole: Role) => {
    if (newRole === user.role) return;
    setSavingRole(user.id);
    try {
      const res = await fetch(`/api/parametres/utilisateurs/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de changer le rôle.");
        return;
      }
      setList((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
      toast.success(`Rôle de ${user.nom} mis à jour.`);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSavingRole(null);
    }
  };

  // -- Suppression -----------------------------------------------------
  const removeUser = async (user: StoreUser) => {
    if (user.id === currentUserId) {
      toast.error("Vous ne pouvez pas vous retirer vous-même.");
      return;
    }
    if (!window.confirm(`Retirer ${user.nom} (${user.email}) de la boutique ?`)) return;
    setRemovingId(user.id);
    try {
      const res = await fetch(`/api/parametres/utilisateurs/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de retirer cet utilisateur.");
        return;
      }
      setList((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`${user.nom} retiré de la boutique.`);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setRemovingId(null);
    }
  };

  const copyPassword = async () => {
    if (!tempCred) return;
    try {
      await navigator.clipboard.writeText(tempCred.password);
      toast.success("Mot de passe copié.");
    } catch {
      toast.error("Impossible de copier automatiquement — sélectionnez-le manuellement.");
    }
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Membres de la boutique ({list.length})</CardTitle>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} />
            Inviter un employé
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucun membre pour le moment.</p>
          ) : (
            list.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{user.nom}</span>
                    <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                    {user.id === currentUserId && <Badge tone="neutral">Vous</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.derniereConnexion
                      ? `Dernière connexion ${formatDistanceToNow(new Date(user.derniereConnexion), {
                          addSuffix: true,
                          locale: fr,
                        })}`
                      : "Jamais connecté"}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:pl-2">
                  <Select
                    value={user.role}
                    disabled={savingRole === user.id}
                    onChange={(e) => changeRole(user, e.target.value as Role)}
                    className="w-36"
                  >
                    <option value="PATRON">Patron</option>
                    <option value="GERANT">Gérant</option>
                    <option value="VENDEUR">Vendeur</option>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resetId === user.id}
                    onClick={() => reinitialiserMotDePasse(user)}
                    title="Générer un nouveau mot de passe et le remettre à l'employé"
                  >
                    <KeyRound size={14} />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={removingId === user.id || user.id === currentUserId}
                    onClick={() => removeUser(user)}
                    title={user.id === currentUserId ? "Vous ne pouvez pas vous retirer vous-même." : undefined}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Matrice de permissions (§14) : <strong>Patron</strong> — accès complet. <strong>Gérant</strong> — accès
        large, sauf abonnement/utilisateurs/sécurité. <strong>Vendeur</strong> — limité à l&apos;écran Vendre et à son
        propre historique de ventes, sans annulation directe.
      </p>

      {/* Dialog invitation */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} title="Inviter un employé">
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <Label htmlFor="invite-nom">Nom</Label>
            <Input id="invite-nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Rôle</Label>
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="VENDEUR">Vendeur</option>
              <option value="GERANT">Gérant</option>
              <option value="PATRON">Patron</option>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Aucun service d&apos;e-mail n&apos;est configuré : un mot de passe temporaire sera généré et affiché
            une seule fois à l&apos;écran suivant — à relayer vous-même à l&apos;employé.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Création..." : "Créer l'accès"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog identifiants temporaires */}
      <Dialog open={tempCred !== null} onClose={() => setTempCred(null)} title="Accès créé">
        {tempCred && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Communiquez ces identifiants à l&apos;employé. Ils ne seront plus affichés après fermeture de cette
              fenêtre — l&apos;employé pourra changer son mot de passe depuis Sécurité &amp; connexion.
            </p>
            <div className="rounded-lg border border-border bg-muted p-3">
              <p>
                <span className="text-muted-foreground">E-mail :</span> <strong>{tempCred.email}</strong>
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-muted-foreground">Mot de passe temporaire :</span>
                <code className="rounded bg-card px-2 py-0.5 font-mono">{tempCred.password}</code>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="rounded p-1 text-muted-foreground hover:bg-card"
                  aria-label="Copier le mot de passe"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setTempCred(null)}>J&apos;ai noté</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
