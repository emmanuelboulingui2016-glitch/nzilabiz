"use client";

// Dérogations individuelles à la matrice de rôle (§14) — le patron voit, pour un employé donné, les
// droits que lui donne son rôle et peut en accorder ou en retirer un par un. L'écart au rôle est
// visible d'un coup d'œil : chaque ligne montre le rôle en fond et, s'il y en a une, la dérogation
// qui s'y superpose (« + accordé » ou « − retiré »).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldMinus, ShieldPlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Permission } from "@/lib/auth/rbac";
import type { Role } from "@/components/parametres/utilisateurs/users-manager";

type EtatPermission = {
  permission: Permission;
  parRole: boolean;
  derogation: "ACCORDEE" | "RETIREE" | null;
  effectif: boolean;
};

// Regroupement purement présentation : mêmes libellés que le reste de l'application (§14), classés
// par écran pour que le patron s'y retrouve plutôt que de lire une liste plate de trente entrées.
const GROUPES: { titre: string; permissions: Permission[] }[] = [
  { titre: "Vendre", permissions: ["vendre.use", "vendre.prix.modifier"] },
  {
    titre: "Ventes",
    permissions: ["ventes.view.all", "ventes.view.own", "ventes.annuler.direct", "ventes.annuler.demander"],
  },
  { titre: "Stock", permissions: ["stock.view", "stock.edit", "stock.ajustement"] },
  { titre: "Clients", permissions: ["clients.view", "clients.edit"] },
  { titre: "Créances", permissions: ["creances.view", "creances.edit"] },
  { titre: "Dépenses", permissions: ["depenses.view", "depenses.edit"] },
  { titre: "Documents", permissions: ["documents.view", "documents.edit"] },
  { titre: "Autres", permissions: ["dashboard.view", "rapports.view", "synchronisation.view", "approbations.decider", "boutiques.reseau"] },
  {
    titre: "Paramètres",
    permissions: [
      "parametres.boutique",
      "parametres.abonnement",
      "parametres.utilisateurs",
      "parametres.securite",
      "parametres.notifications",
      "parametres.devise",
      "parametres.synchronisation",
    ],
  },
];

const LABELS: Record<Permission, string> = {
  "dashboard.view": "Voir le tableau de bord",
  "vendre.use": "Utiliser la caisse (Vendre)",
  "vendre.prix.modifier": "Négocier le prix au comptoir",
  "ventes.view.all": "Voir toutes les ventes de la boutique",
  "ventes.view.own": "Voir uniquement ses propres ventes",
  "ventes.annuler.direct": "Annuler une vente directement",
  "ventes.annuler.demander": "Demander l'annulation d'une vente",
  "stock.view": "Voir le stock",
  "stock.edit": "Modifier le stock",
  "stock.ajustement": "Ajuster le stock (casse, perte...)",
  "clients.view": "Voir les clients",
  "clients.edit": "Modifier les clients",
  "creances.view": "Voir les créances",
  "creances.edit": "Modifier les créances",
  "depenses.view": "Voir les dépenses",
  "depenses.edit": "Modifier les dépenses",
  "synchronisation.view": "Voir la synchronisation",
  "documents.view": "Voir les documents",
  "documents.edit": "Modifier les documents",
  "rapports.view": "Voir les rapports",
  "boutiques.reseau": "Gérer le réseau de boutiques",
  "parametres.boutique": "Modifier les infos boutique",
  "parametres.abonnement": "Gérer l'abonnement",
  "parametres.utilisateurs": "Gérer les utilisateurs",
  "parametres.securite": "Gérer la sécurité",
  "parametres.notifications": "Gérer les notifications",
  "parametres.devise": "Gérer la devise",
  "parametres.synchronisation": "Gérer la synchronisation",
  "approbations.decider": "Décider des approbations",
};

export function PermissionsDialog({
  open,
  onClose,
  userId,
  userNom,
  role,
  estSoi,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userNom: string;
  role: Role;
  /** Vrai si la ligne concerne le patron connecté lui-même — le garde-fou serveur s'applique de
   *  toute façon, mais on évite de proposer un contrôle qui sera de toute façon refusé. */
  estSoi: boolean;
}) {
  // Pas de reset explicite de `chargement` à l'ouverture : le parent (users-manager.tsx) ne monte
  // ce composant QUE pendant qu'il est ouvert (`{permissionsFor && <PermissionsDialog ... />}`), donc
  // chaque ouverture est un montage neuf avec l'état initial `true` — inutile de le refixer à la
  // main, et ça évite un appel à `setState` synchrone au corps de l'effet (react-hooks/set-state-in-effect).
  const [chargement, setChargement] = useState(true);
  const [permissions, setPermissions] = useState<EtatPermission[]>([]);
  const [enCours, setEnCours] = useState<Permission | null>(null);

  useEffect(() => {
    let annule = false;
    fetch(`/api/parametres/utilisateurs/${userId}/permissions`)
      .then((res) => res.json())
      .then((data) => {
        if (!annule) setPermissions(data.permissions ?? []);
      })
      .catch(() => {
        if (!annule) toast.error("Impossible de charger les droits de cet employé.");
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [userId]);

  async function basculer(permission: Permission, accorder: boolean) {
    setEnCours(permission);
    try {
      const res = await fetch(`/api/parametres/utilisateurs/${userId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission, accorder }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Modification impossible.");
        return;
      }
      setPermissions(data.permissions ?? []);
    } catch {
      toast.error("Erreur réseau — réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  const parPermission = new Map(permissions.map((p) => [p.permission, p]));

  return (
    <Dialog open={open} onClose={onClose} title={`Droits de ${userNom}`} className="max-w-2xl">
      {chargement ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            En vert : ce que donne le rôle <strong>{ROLE_LABEL[role]}</strong>. Utilisez les boutons pour
            accorder un droit supplémentaire ou en retirer un — l&apos;écart avec le rôle reste visible avec
            un badge.
          </p>
          {GROUPES.map((groupe) => (
            <div key={groupe.titre}>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {groupe.titre}
              </h4>
              <div className="space-y-1.5">
                {groupe.permissions.map((permission) => {
                  const etat = parPermission.get(permission);
                  if (!etat) return null;
                  const verrouille =
                    estSoi && permission === "parametres.utilisateurs" && etat.effectif;
                  return (
                    <div
                      key={permission}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {etat.effectif ? (
                          <ShieldCheck size={15} className="shrink-0 text-success" />
                        ) : (
                          <ShieldMinus size={15} className="shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-sm">{LABELS[permission]}</span>
                        {etat.derogation === "ACCORDEE" && (
                          <Badge tone="success" className="shrink-0">
                            <ShieldPlus size={11} /> accordé
                          </Badge>
                        )}
                        {etat.derogation === "RETIREE" && (
                          <Badge tone="danger" className="shrink-0">
                            <ShieldMinus size={11} /> retiré
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={etat.effectif ? "outline" : "secondary"}
                        disabled={enCours === permission || verrouille}
                        title={verrouille ? "Vous ne pouvez pas vous retirer ce droit à vous-même." : undefined}
                        onClick={() => basculer(permission, !etat.effectif)}
                      >
                        {enCours === permission ? "..." : etat.effectif ? "Retirer" : "Accorder"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  PATRON: "Patron",
  GERANT: "Gérant",
  VENDEUR: "Vendeur",
};
