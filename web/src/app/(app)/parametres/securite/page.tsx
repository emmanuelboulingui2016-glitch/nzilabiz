import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { SecurityForm } from "@/components/parametres/securite/security-form";
import { ActiveSessions } from "@/components/parametres/securite/active-sessions";

// Onglet Sécurité & connexion — §14 du cahier des charges + amélioration 🔧 (2FA + sessions
// actives). Réservé au Patron par la matrice de permissions (rbac.ts).
export default async function SecuritePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.securite")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) redirect("/connexion");

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <SecurityForm
        initial={{
          nom: user.nom,
          email: user.email,
          aMotDePasse: Boolean(user.motDePasseHash),
          googleLie: Boolean(user.googleId),
          twoFactorActive: user.twoFactorActive,
        }}
      />
      <ActiveSessions currentUserId={session.userId} currentDeviceId={session.deviceId ?? null} />
    </div>
  );
}
