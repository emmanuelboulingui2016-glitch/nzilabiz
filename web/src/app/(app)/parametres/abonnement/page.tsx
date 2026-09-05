import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { getPlatformSettings, contactCommercial } from "@/lib/platform-settings";
import { lireTarifs } from "@/lib/tarifs-serveur";
import { SubscriptionView } from "@/components/parametres/abonnement/subscription-view";
import { DemandePaiement } from "@/components/abonnement/demande-paiement";

// Onglet Abonnement — §14 + §16 du cahier des charges. Purement informatif côté données
// (plan courant, dates d'expiration) : aucune mutation serveur, le paiement Mobile Money est
// un stub (voir composant) et le clic "Choisir" ne modifie pas `stores.plan` dans ce build.
export default async function AbonnementPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.abonnement")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) redirect("/connexion");

  // Enchaînée, jamais en parallèle : le pooler en mode transaction ne rend pas la main quand
  // plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  const reglages = await getPlatformSettings();
  const grille = await lireTarifs();

  const contact = contactCommercial(reglages);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Demande de paiement Entreprise en attente, le cas échéant — chargée côté client, ne
          s'affiche que si elle existe. Ajoutée sans toucher à `SubscriptionView` : voir
          `src/components/abonnement/demande-paiement.tsx`. */}
      <DemandePaiement contact={contact} />
      <SubscriptionView
        plan={store.plan}
        essaiExpireLe={store.essaiExpireLe ? store.essaiExpireLe.toISOString() : null}
        abonnementExpireLe={store.abonnementExpireLe ? store.abonnementExpireLe.toISOString() : null}
        contact={contact}
        grille={grille}
      />
    </div>
  );
}
