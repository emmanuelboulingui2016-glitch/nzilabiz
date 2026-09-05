// Matrice de permissions par rôle — §14 Amélioration "Utilisateurs" du cahier des charges.
// Patron : accès complet. Gérant : accès large sauf paramètres sensibles/abonnement.
// Vendeur : limité à Vendre + son propre historique de ventes, sans droit d'annulation
// sans validation du Patron/Gérant (cf. §7).

export type Role = "PATRON" | "GERANT" | "VENDEUR";

// Liste canonique des permissions — tableau plutôt que directement un type union, pour qu'il existe
// une valeur à l'exécution (pas seulement un type effacé à la compilation). C'est ce tableau qui
// alimente la validation Zod des routes de dérogation (`.../[id]/permissions`) : le vocabulaire qui
// fait autorité reste ici, la route ne fait que le référencer plutôt que de le dupliquer.
export const PERMISSIONS = [
  "dashboard.view",
  "vendre.use",
  // Négocier le prix d'un article au comptoir. Accordée par défaut à tous, y compris au vendeur :
  // un commerçant d'Afrique centrale discute ses prix, et le logiciel doit suivre le commerce réel
  // plutôt que l'inverse. Le patron peut la retirer à un employé en particulier — c'est justement
  // ce que permettent les dérogations. Chaque écart au catalogue reste enregistré sur la ligne de
  // vente (prixCatalogueUnitaire), donc un rabais consenti se distingue toujours d'un détournement.
  "vendre.prix.modifier",
  "ventes.view.all",
  "ventes.view.own",
  "ventes.annuler.direct",
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
  "boutiques.reseau",
  "parametres.boutique",
  "parametres.abonnement",
  "parametres.utilisateurs",
  "parametres.securite",
  "parametres.notifications",
  "parametres.devise",
  "parametres.synchronisation",
  "approbations.decider",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[]> = {
  PATRON: [
    "dashboard.view",
    "vendre.use",
    "vendre.prix.modifier",
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
    "vendre.prix.modifier",
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
  VENDEUR: [
    "dashboard.view",
    "vendre.use",
    "vendre.prix.modifier",
    "ventes.view.own",
    "ventes.annuler.demander",
    "stock.view",
  ],
};

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

/**
 * Dérogation individuelle telle que résolue en mémoire — miroir de `employeePermissionOverrides`
 * (schema.ts), mais sans les colonnes de traçabilité (storeId, accordeParId, revoqueLe...) qui ne
 * comptent pas pour le calcul du droit effectif, seulement pour l'audit.
 */
export type PermissionOverride = {
  permission: Permission;
  action: "ACCORDEE" | "RETIREE";
  /** Sert à départager plusieurs dérogations actives sur la même permission (voir schema.ts : aucune
   *  contrainte SQL n'empêche ce cas) — la plus récente l'emporte. */
  creeLe: Date;
};

/**
 * Résout l'ensemble effectif des permissions d'un utilisateur : la matrice de son rôle, puis la
 * dérogation active la plus récente sur chaque permission. `overrides` ne doit contenir que des
 * dérogations *actives* (non révoquées) — c'est à l'appelant de filtrer `revoqueLe is null` en
 * base ; cette fonction reste pure et ne sait rien de la révocation, seulement de l'ordre temporel.
 */
export function resoudrePermissions(role: Role, overrides: PermissionOverride[]): Permission[] {
  const effectif = new Set(permissionsFor(role));

  // Une seule dérogation retenue par permission : la plus récente. On trie du plus ancien au plus
  // récent et on laisse chaque écriture dans la Map écraser la précédente, la dernière écriture
  // gagne donc naturellement.
  const parPermission = new Map<Permission, PermissionOverride>();
  const triees = [...overrides].sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime());
  for (const o of triees) parPermission.set(o.permission, o);

  for (const o of parPermission.values()) {
    if (o.action === "ACCORDEE") effectif.add(o.permission);
    else effectif.delete(o.permission);
  }

  return [...effectif];
}

export function can(role: Role, permission: Permission, overrides?: PermissionOverride[]): boolean {
  // Troisième paramètre optionnel : les dizaines d'appelants existants (routes API, pages) passent
  // toujours deux arguments et gardent exactement le comportement d'avant — matrice de rôle
  // uniquement. Seuls les appelants qui ont chargé les dérogations effectives de l'utilisateur (voir
  // `permissionsEffectives` dans `session.ts`) passent ce troisième argument pour vérifier le droit
  // réel de la personne plutôt que celui de son seul rôle.
  if (overrides !== undefined) return resoudrePermissions(role, overrides).includes(permission);
  return MATRIX[role]?.includes(permission) ?? false;
}
