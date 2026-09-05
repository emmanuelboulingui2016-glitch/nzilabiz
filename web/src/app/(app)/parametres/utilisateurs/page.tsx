import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores, users } from "@/db/schema";
import { UsersManager } from "@/components/parametres/utilisateurs/users-manager";
import { InvitationsPanel } from "@/components/parametres/utilisateurs/invitations-panel";
import { ConnexionsPanel } from "@/components/parametres/utilisateurs/connexions-panel";
import { connexionsRecentes, supprimesRestaurables } from "@/components/parametres/utilisateurs/queries";

// Onglet Utilisateurs — §14 du cahier des charges. Seul le Patron gère les membres de la
// boutique (cf. matrice de permissions rbac.ts) : c'est le SEUL endroit où ils sont gérés, il n'y
// a pas de duplication sur l'onglet Boutique.
export default async function UtilisateursPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.utilisateurs")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  // Requêtes enchaînées, jamais en parallèle (pooler Supavisor).
  const list = await db.query.users.findMany({
    where: and(eq(users.storeId, session.storeId), isNull(users.desactiveLe)),
    orderBy: (u, { asc }) => [asc(u.creeLe)],
  });
  const boutique = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });
  const supprimes = await supprimesRestaurables(session.storeId);
  const connexions = await connexionsRecentes(session.storeId);

  const utilisateurCourant = list.find((u) => u.id === session.userId);

  return (
    <div className="space-y-4 pb-20 md:pb-0">
    <InvitationsPanel storeName={boutique?.nom ?? "votre boutique"} />
    <UsersManager
      currentUserId={session.userId}
      currentUserHasPassword={Boolean(utilisateurCourant?.motDePasseHash)}
      initialUsers={list.map((u) => ({
        id: u.id,
        nom: u.nom,
        email: u.email,
        telephone: u.telephone,
        role: u.role,
        derniereConnexion: u.derniereConnexion ? u.derniereConnexion.toISOString() : null,
        creeLe: u.creeLe.toISOString(),
        aMotDePasse: Boolean(u.motDePasseHash),
        googleId: Boolean(u.googleId),
      }))}
      initialSupprimes={supprimes.map((u) => ({
        id: u.id,
        nom: u.nom,
        email: u.email,
        telephone: u.telephone,
        role: u.role,
        desactiveLe: u.desactiveLe.toISOString(),
        restaurationExpireLe: u.restaurationExpireLe.toISOString(),
      }))}
    />
    <ConnexionsPanel connexions={connexions} />
    </div>
  );
}
