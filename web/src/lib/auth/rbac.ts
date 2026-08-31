// Matrice de permissions par rôle — §14 Amélioration "Utilisateurs" du cahier des charges.
// Patron : accès complet. Gérant : accès large sauf paramètres sensibles/abonnement.
// Vendeur : limité à Vendre + son propre historique de ventes, sans droit d'annulation
// sans validation du Patron/Gérant (cf. §7).

export type Role = "PATRON" | "GERANT" | "VENDEUR";

export type Permission =
  | "dashboard.view"
  | "vendre.use"
  | "ventes.view.all"
  | "ventes.view.own"
  | "ventes.annuler.direct"
  | "ventes.annuler.demander"
  | "stock.view"
  | "stock.edit"
  | "stock.ajustement"
  | "clients.view"
  | "clients.edit"
  | "creances.view"
  | "creances.edit"
  | "depenses.view"
  | "depenses.edit"
  | "synchronisation.view"
  | "documents.view"
  | "documents.edit"
  | "rapports.view"
  | "boutiques.reseau"
  | "parametres.boutique"
  | "parametres.abonnement"
  | "parametres.utilisateurs"
  | "parametres.securite"
  | "parametres.notifications"
  | "parametres.devise"
  | "parametres.synchronisation"
  | "approbations.decider";

const MATRIX: Record<Role, Permission[]> = {
  PATRON: [
    "dashboard.view",
    "vendre.use",
    "ventes.view.all",
    "ventes.annuler.direct",
    "stock.view",
    "stock.edit",
    "stock.ajustement",
    "clients.view",
    "clients.edit",
    "creances.view",
    "creances.edit",
    "depenses.view",
    "depenses.edit",
    "synchronisation.view",
    "documents.view",
    "documents.edit",
    "rapports.view",
    // Le réseau de boutiques engage le contrat : un gérant administre sa boutique, il n'en ouvre
    // pas de nouvelle au nom du patron.
    "boutiques.reseau",
    "parametres.boutique",
    "parametres.abonnement",
    "parametres.utilisateurs",
    "parametres.securite",
    "parametres.notifications",
    "parametres.devise",
    "parametres.synchronisation",
    "approbations.decider",
  ],
  GERANT: [
    "dashboard.view",
    "vendre.use",
    "ventes.view.all",
    "ventes.annuler.demander",
    "stock.view",
    "stock.edit",
    "stock.ajustement",
    "clients.view",
    "clients.edit",
    "creances.view",
    "creances.edit",
    "depenses.view",
    "depenses.edit",
    "synchronisation.view",
    "documents.view",
    "documents.edit",
    "rapports.view",
    "parametres.boutique",
    "parametres.notifications",
    "parametres.synchronisation",
    "approbations.decider",
  ],
  VENDEUR: ["dashboard.view", "vendre.use", "ventes.view.own", "ventes.annuler.demander", "stock.view"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}
