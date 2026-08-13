import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { ReceiptPreview } from "@/components/parametres/facturation/receipt-preview";

// Onglet Facturation — §14 : « apparence du reçu » (logo, téléphone, adresse, message de bas de
// reçu) avec aperçu en direct.
//
// Choix retenu : ces champs sont TOUS déjà éditables dans l'onglet Boutique (même table `stores`,
// pas de duplication de source de vérité). Cet onglet se concentre sur l'aperçu en direct du reçu
// tel qu'il sera imprimé, avec un raccourci vers Boutique pour modifier logo/téléphone/adresse, et
// permet en plus d'éditer directement ici la « note de bas de reçu » pour un accès rapide (comme
// dans l'app d'origine), en réutilisant l'endpoint PUT /api/parametres/boutique — pas de route
// dédiée pour cet onglet.
export default async function FacturationPage() {
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
    <ReceiptPreview
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
