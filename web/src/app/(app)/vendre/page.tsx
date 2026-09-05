import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { chargerVendre } from "@/components/vendre/get-vendre-data";
import { VendreScreen } from "@/components/vendre/vendre-screen";

export default async function VendrePage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  if (!can(session.role, "vendre.use")) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas accès à l&apos;écran de vente.</p>
      </div>
    );
  }

  const store = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });

  // La grille part remplie avec la page : c'est l'écran le plus utilisé, il ne doit rien attendre.
  const initial = await chargerVendre(session.storeId);

  return (
    <VendreScreen
      initial={initial}
      storeId={session.storeId}
      userId={session.userId}
      storeName={store?.nom ?? "NzilaBiz"}
      // Le champ de prix n'est même rendu côté client que si ce droit est vrai (voir cart-panel.tsx) ;
      // le serveur revalide de toute façon le même droit à l'enregistrement (POST /api/vendre et
      // /api/vendre/sync) — cette prop ne pilote que l'affichage, jamais l'acceptation d'un prix.
      canModifierPrix={can(session.role, "vendre.prix.modifier")}
    />
  );
}
