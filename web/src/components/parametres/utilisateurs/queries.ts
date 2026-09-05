// Helpers de lecture serveur pour le module Paramètres > Utilisateurs (§14).
//
// La logique pure (résolution des administrateurs, fuseau horaire, fenêtre de restauration) vit
// dans permissions-logic.ts, qui n'importe pas `db` et reste testable sans base de données — voir
// ce fichier pour le pourquoi. Celui-ci ne fait que lire en base et déléguer le calcul.

import { and, asc, desc, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { devices, employeePermissionOverrides, users } from "@/db/schema";
import type { Permission, PermissionOverride, Role } from "@/lib/auth/rbac";
import {
  calculerExpirationRestauration,
  derniereDerogationParUtilisateur,
  estAujourdHuiPourLeCommercant,
  heureLocaleCommercant,
  resoudreAdministrateurs,
  restaurationExpiree,
  type MembreBoutique,
} from "@/components/parametres/utilisateurs/permissions-logic";

// Ré-exportées pour que les appelants existants (routes API, composants) n'aient qu'un seul module
// à connaître ; la séparation avec permissions-logic.ts n'est motivée que par la testabilité.
export {
  calculerExpirationRestauration,
  derniereDerogationParUtilisateur,
  estAujourdHuiPourLeCommercant,
  heureLocaleCommercant,
  resoudreAdministrateurs,
  restaurationExpiree,
};
export type { MembreBoutique };

/**
 * Nombre de Patrons actifs pour la boutique, en excluant éventuellement un utilisateur donné.
 *
 * Filtre `desactiveLe is null` : un Patron supprimé (chantier B, restaurable sous 48h) ne doit plus
 * compter comme rempart contre le retrait du dernier Patron actif — sans ce filtre, retirer le
 * dernier Patron *réellement* accessible resterait possible tant qu'un Patron supprimé traîne
 * encore dans la fenêtre de restauration.
 */
export async function countPatrons(storeId: string, excludeUserId?: string): Promise<number> {
  const rows = await db.query.users.findMany({
    where: excludeUserId
      ? and(eq(users.storeId, storeId), eq(users.role, "PATRON"), isNull(users.desactiveLe), ne(users.id, excludeUserId))
      : and(eq(users.storeId, storeId), eq(users.role, "PATRON"), isNull(users.desactiveLe)),
  });
  return rows.length;
}

// ---------------------------------------------------------------------------------------------
// Chantier A — dérogations de permissions (employeePermissionOverrides)
// ---------------------------------------------------------------------------------------------

/** Dérogations actives (non révoquées) d'un utilisateur, quel que soit leur sens (ACCORDEE/RETIREE). */
export async function derogationsActivesDe(userId: string): Promise<PermissionOverride[]> {
  const lignes = await db
    .select({
      permission: employeePermissionOverrides.permission,
      action: employeePermissionOverrides.action,
      creeLe: employeePermissionOverrides.creeLe,
    })
    .from(employeePermissionOverrides)
    .where(and(eq(employeePermissionOverrides.userId, userId), isNull(employeePermissionOverrides.revoqueLe)))
    .orderBy(asc(employeePermissionOverrides.creeLe));

  return lignes.map((l) => ({
    permission: l.permission as Permission,
    action: l.action,
    creeLe: l.creeLe,
  }));
}

/** Lit les membres et les dérogations de `parametres.utilisateurs` de la boutique, puis résout. */
export async function administrateursDeLaBoutique(storeId: string): Promise<Map<string, boolean>> {
  const membres: MembreBoutique[] = await db.query.users.findMany({
    where: and(eq(users.storeId, storeId), isNull(users.desactiveLe)),
    columns: { id: true, role: true },
  });

  const lignes = await db
    .select({
      userId: employeePermissionOverrides.userId,
      action: employeePermissionOverrides.action,
      creeLe: employeePermissionOverrides.creeLe,
    })
    .from(employeePermissionOverrides)
    .where(
      and(
        eq(employeePermissionOverrides.storeId, storeId),
        eq(employeePermissionOverrides.permission, "parametres.utilisateurs"),
        isNull(employeePermissionOverrides.revoqueLe)
      )
    );

  return resoudreAdministrateurs(membres, derniereDerogationParUtilisateur(lignes));
}

// ---------------------------------------------------------------------------------------------
// Chantier B — comptes supprimés restaurables sous 48h
// ---------------------------------------------------------------------------------------------

export type UtilisateurSupprime = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  role: Role;
  desactiveLe: Date;
  restaurationExpireLe: Date;
};

/**
 * Comptes désactivés par un Patron (pas une auto-suppression, jamais restaurable) et encore dans
 * leur fenêtre de restauration de 48h.
 */
export async function supprimesRestaurables(storeId: string): Promise<UtilisateurSupprime[]> {
  const rows = await db.query.users.findMany({
    where: and(
      eq(users.storeId, storeId),
      isNotNull(users.desactiveLe),
      isNotNull(users.restaurationExpireLe),
      gt(users.restaurationExpireLe, new Date())
    ),
    orderBy: (u, { desc: d }) => [d(u.desactiveLe)],
  });

  return rows
    .filter((u): u is typeof u & { desactiveLe: Date; restaurationExpireLe: Date } =>
      u.desactiveLe !== null && u.restaurationExpireLe !== null
    )
    .map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      telephone: u.telephone,
      role: u.role,
      desactiveLe: u.desactiveLe,
      restaurationExpireLe: u.restaurationExpireLe,
    }));
}

// ---------------------------------------------------------------------------------------------
// Chantier C — connexions récentes (table `devices`, déjà un journal de connexion — voir schema.ts)
// ---------------------------------------------------------------------------------------------

export type ConnexionRecente = {
  id: string;
  userId: string;
  userNom: string | null;
  appareil: string;
  userAgent: string | null;
  derniereActivite: Date;
  revoque: boolean;
};

/**
 * Connexions les plus récentes de la boutique, tous employés confondus, appareil et utilisateur
 * joints — requête écrite ici plutôt que réutilisée depuis `components/synchronisation/queries.ts`
 * (hors périmètre de cette tâche) : `getDevices` y fait déjà exactement cette jointure, mais ce
 * fichier appartient à un autre module et ne doit pas être modifié pour cette tâche.
 */
export async function connexionsRecentes(storeId: string, limite = 20): Promise<ConnexionRecente[]> {
  const rows = await db
    .select({
      id: devices.id,
      userId: devices.userId,
      userNom: users.nom,
      appareil: devices.nom,
      userAgent: devices.userAgent,
      derniereActivite: devices.derniereActivite,
      revoque: devices.revoque,
    })
    .from(devices)
    .innerJoin(users, eq(devices.userId, users.id))
    .where(eq(devices.storeId, storeId))
    .orderBy(desc(devices.derniereActivite))
    .limit(limite);

  return rows;
}
