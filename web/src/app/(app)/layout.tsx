import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isSuperAdminEmail } from "@/lib/auth/superadmin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { AppShell } from "@/components/layout/app-shell";
import { etatBoutiqueCourante } from "@/lib/abonnement";
import { boutiquesAccessibles } from "@/lib/reseau";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/connexion");

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

  // Enchaînées, jamais en parallèle : le pooler en mode transaction ne rend pas la main quand
  // plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  //
  // Cette lecture remplace celle du seul nom de la boutique et coûte le même aller-retour : elle
  // renvoie les boutiques accessibles au compte — une seule dans le cas courant. Ne sont lus que
  // l'identifiant et le nom : la ligne complète embarque `logo_url`, une image entière en base64,
  // et ce calque s'exécute au-dessus de chaque page de l'application.
  const boutiques = await boutiquesAccessibles(session.userId);
  const boutiqueActive = boutiques.find((b) => b.id === session.storeId);

  const reglages = await getPlatformSettings();

  return (
    <AppShell
      role={session.role}
      userName={session.nom}
      storeName={boutiqueActive?.nom ?? "NzilaBiz"}
      boutiques={boutiques.map((b) => ({ id: b.id, nom: b.nom }))}
      boutiqueActiveId={session.storeId}
      formule={etat?.plan ?? "ESSAI"}
      superAdmin={isSuperAdminEmail(session.email)}
      annonce={reglages.annonceActive ? reglages.annonce : null}
    >
      {children}
    </AppShell>
  );
}
