import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db/client";
import { stores, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAccount } from "@/components/parametres/securite/delete-account";
import { ChangeEmailForm } from "@/components/parametres/compte/change-email-form";
import { emailConfigure } from "@/lib/email/envoyer";

// Onglet « Mon compte » — visible par tous les rôles : chacun doit pouvoir consulter son accès
// et le supprimer, y compris un vendeur qui n'a aucun droit sur les réglages de la boutique.
export default async function ComptePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });
  if (!user) redirect("/connexion");

  const ROLE_LABELS: Record<string, string> = {
    PATRON: "Patron — accès complet",
    GERANT: "Gérant — gestion quotidienne",
    VENDEUR: "Vendeur — caisse et ses propres ventes",
  };

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>Mon compte</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nom</dt>
              <dd className="font-semibold">{user.nom}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-semibold">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rôle</dt>
              <dd className="font-semibold">{ROLE_LABELS[session.role] ?? session.role}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Boutique</dt>
              <dd className="font-semibold">{store?.nom ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Compte créé le</dt>
              <dd className="font-semibold">{user.creeLe.toLocaleDateString("fr-FR")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mode de connexion</dt>
              <dd className="font-semibold">
                {[user.motDePasseHash ? "Mot de passe" : null, user.googleId ? "Google" : null]
                  .filter(Boolean)
                  .join(" + ") || "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Vos données sont traitées conformément à notre{" "}
            <Link href="/confidentialite" className="font-semibold underline">
              politique de confidentialité
            </Link>{" "}
            et à nos{" "}
            <Link href="/conditions" className="font-semibold underline">
              conditions d&apos;utilisation
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {/* Un seul e-mail par boutique, celui du Patron (voir schéma `users`) : les comptes
          d'employés se connectent par téléphone et n'ont rien à changer ici. */}
      {session.role === "PATRON" ? (
        <ChangeEmailForm
          email={user.email}
          nouvelEmail={user.nouvelEmail}
          emailVerifie={Boolean(user.emailVerifieLe)}
          aMotDePasse={Boolean(user.motDePasseHash)}
          envoiDisponible={emailConfigure()}
        />
      ) : null}

      <DeleteAccount
        role={session.role}
        storeName={store?.nom ?? ""}
        aMotDePasse={Boolean(user.motDePasseHash)}
      />
    </div>
  );
}
