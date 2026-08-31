import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { AppShell } from "@/components/layout/app-shell";
import { etatBoutiqueCourante } from "@/lib/abonnement";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion");

  // Enchaînées, jamais en parallèle : le pooler en mode transaction ne rend pas la main quand
  // plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  // Seul le nom est lu : la ligne complète embarque `logo_url`, une image entière en base64, et
  // ce calque s'exécute au-dessus de chaque page de l'application.
  const store = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { nom: true },
  });

  // Échéance dépassée : redirection vers /abonnement-expire, page située hors de ce calque.
  //
  // Rendre l'écran de blocage ici, à la place de `{children}`, ne suffisait pas : Next.js rend la
  // page en parallèle du calque, et ne pas l'afficher ne l'empêche ni de s'exécuter, ni de déposer
  // ses résultats dans la charge envoyée au navigateur. Le contrôle a montré les chiffres d'affaires
  // d'une boutique bloquée présents dans le HTML. `redirect()` interrompt le rendu ; c'est la seule
  // façon de garantir qu'aucune donnée ne parte.
  //
  // Ne bloque jamais un administrateur de la plateforme ni une boutique du programme de test : la
  // règle est dans `etatBoutiqueCourante`, pas ici, pour qu'aucun appelant ne puisse l'oublier.
  const etat = await etatBoutiqueCourante();
  if (etat && !etat.actif) redirect("/abonnement-expire");

  const reglages = await getPlatformSettings();

  return (
    <AppShell
      role={session.role}
      userName={session.nom}
      storeName={store?.nom ?? "NzilaBiz"}
      superAdmin={isSuperAdminEmail(session.email)}
      annonce={reglages.annonceActive ? reglages.annonce : null}
    >
      {children}
    </AppShell>
  );
}
