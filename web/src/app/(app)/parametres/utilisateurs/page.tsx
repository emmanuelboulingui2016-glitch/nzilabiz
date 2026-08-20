import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores, users } from "@/db/schema";
import { UsersManager } from "@/components/parametres/utilisateurs/users-manager";
import { InvitationsPanel } from "@/components/parametres/utilisateurs/invitations-panel";

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

  const list = await db.query.users.findMany({
    where: eq(users.storeId, session.storeId),
    orderBy: (u, { asc }) => [asc(u.creeLe)],
  });
  const boutique = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });

  return (
    <div className="space-y-4 pb-20 md:pb-0">
    <InvitationsPanel storeName={boutique?.nom ?? "votre boutique"} />
    <UsersManager
      currentUserId={session.userId}
      initialUsers={list.map((u) => ({
        id: u.id,
        nom: u.nom,
        email: u.email,
        role: u.role,
        derniereConnexion: u.derniereConnexion ? u.derniereConnexion.toISOString() : null,
        creeLe: u.creeLe.toISOString(),
        aMotDePasse: Boolean(u.motDePasseHash),
        googleId: Boolean(u.googleId),
      }))}
    />
    </div>
  );
}
