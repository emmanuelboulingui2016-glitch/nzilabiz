"use client";

import { useState, type FormEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Copy, KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";

export type Role = "PATRON" | "GERANT" | "VENDEUR";

export type StoreUser = {
  id: string;
  nom: string;
  // Le patron garde son e-mail, ses employés ont un numéro : les deux formes coexistent, jamais
  // les deux en même temps pour un même compte.
  email: string | null;
  telephone: string | null;
  role: Role;
  derniereConnexion: string | null;
  creeLe: string;
  aMotDePasse: boolean;
  googleId: boolean;
};

/** Identifiant affiché : le téléphone d'un employé prime sur l'e-mail quand les deux existent. */
function identifiantAffiche(user: StoreUser): string {
  return user.telephone ?? user.email ?? "—";
}

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
  const [tempCred, setTempCred] = useState<{ identifiant: string; password: string } | null>(null);

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
      setTempCred({ identifiant: identifiantAffiche(user), password: data.tempPassword });
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setResetId(null);
    }
  }

  // -- Invitation --------------------------------------------------------
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState<Role>("VENDEUR");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/parametres/utilisateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, telephone, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de créer cet utilisateur.");
        return;
      }
      setList((prev) => [...prev, data.user]);
      setInviteOpen(false);
      setTempCred({ identifiant: identifiantAffiche(data.user), password: data.tempPassword });
      setNom("");
      setTelephone("");
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

  // -- Modification (nom, téléphone) --------------------------------------
  // Un vendeur change souvent de puce ou de téléphone : corriger son numéro ne doit pas obliger à
  // recréer le compte, sous peine de perdre son historique de ventes.
  const [editUser, setEditUser] = useState<StoreUser | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editTelephone, setEditTelephone] = useState("");
  const [saving, setSaving] = useState(false);

  function ouvrirEdition(user: StoreUser) {
    setEditUser(user);
    setEditNom(user.nom);
    setEditTelephone(user.telephone ?? "");
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/parametres/utilisateurs/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: editNom, telephone: editTelephone || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Impossible d'enregistrer ces modifications.");
        return;
      }
      setList((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, nom: editNom, telephone: editTelephone || null } : u)));
      toast.success(`Informations de ${editNom} mises à jour.`);
      setEditUser(null);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setSaving(false);
    }
  };

  // -- Suppression -----------------------------------------------------
  const removeUser = async (user: StoreUser) => {
    if (user.id === currentUserId) {
      toast.error("Vous ne pouvez pas vous retirer vous-même.");
      return;
    }
    if (!window.confirm(`Retirer ${user.nom} (${identifiantAffiche(user)}) de la boutique ?`)) return;
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
                  <p className="text-xs text-muted-foreground">{identifiantAffiche(user)}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.derniereConnexion
                      ? `Dernière connexion ${formatDistanceToNow(new Date(user.derniereConnexion), {
                          addSuffix: true,
                          locale: fr,
                        })}`
                      : "Jamais connecté"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:pl-2">
                  <Select
                    value={user.role}
                    disabled={savingRole === user.id}
                    onChange={(e) => changeRole(user, e.target.value as Role)}
                    className="h-11 w-36"
                    aria-label={`Rôle de ${user.nom}`}
                  >
                    <option value="PATRON">Patron</option>
                    <option value="GERANT">Gérant</option>
                    <option value="VENDEUR">Vendeur</option>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => ouvrirEdition(user)}
                    aria-label={`Modifier le nom et le téléphone de ${user.nom}`}
                    title="Modifier le nom et le téléphone"
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={resetId === user.id}
                    onClick={() => reinitialiserMotDePasse(user)}
                    aria-label={`Générer un nouveau mot de passe pour ${user.nom}`}
                    title="Générer un nouveau mot de passe et le remettre à l'employé"
                  >
                    <KeyRound size={16} />
                  </Button>
                  <Button
                    variant="danger"
                    size="icon"
                    className="h-11 w-11"
                    disabled={removingId === user.id || user.id === currentUserId}
                    onClick={() => removeUser(user)}
                    aria-label={`Retirer ${user.nom} de la boutique`}
                    title={user.id === currentUserId ? "Vous ne pouvez pas vous retirer vous-même." : undefined}
                  >
                    <Trash2 size={16} />
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
            <Label htmlFor="invite-telephone">Téléphone</Label>
            <Input
              id="invite-telephone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07 00 00 00"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              L&apos;employé se connectera avec ce numéro, sans adresse e-mail.
            </p>
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

      {/* Dialog modification (nom, téléphone) */}
      <Dialog open={editUser !== null} onClose={() => setEditUser(null)} title="Modifier l'accès">
        {editUser && (
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <Label htmlFor="edit-nom">Nom</Label>
              <Input id="edit-nom" value={editNom} onChange={(e) => setEditNom(e.target.value)} required />
            </div>
            {editUser.email && (
              <div>
                <Label htmlFor="edit-email">E-mail</Label>
                {/* L'e-mail du patron n'est pas modifiable ici : il sert d'identifiant durable et sa
                    mise à jour n'est pas couverte par ce formulaire. */}
                <Input id="edit-email" value={editUser.email} disabled />
              </div>
            )}
            <div>
              <Label htmlFor="edit-telephone">Téléphone</Label>
              <Input
                id="edit-telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07 00 00 00"
                value={editTelephone}
                onChange={(e) => setEditTelephone(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
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
                <span className="text-muted-foreground">Identifiant :</span> <strong>{tempCred.identifiant}</strong>
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
