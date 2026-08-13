import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { BoutiqueForm } from "@/components/parametres/boutique/boutique-form";

export default async function BoutiquePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.boutique")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) redirect("/connexion");

  return (
    <BoutiqueForm
      initial={{
        nom: store.nom,
        logoUrl: store.logoUrl,
        telephone: store.telephone,
        ville: store.ville,
        pays: store.pays,
        indicatif: store.indicatif,
        typeCommerce: store.typeCommerce,
        quartier: store.quartier ?? store.adresse,
        noteBasFacture: store.noteBasFacture,
      }}
    />
  );
}
