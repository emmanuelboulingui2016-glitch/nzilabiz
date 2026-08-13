import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { MobileMoneyForm } from "@/components/parametres/mobile-money/mobile-money-form";

// Onglet Mobile Money — §14 + §16 🔧. Marqué « arrive bientôt » dans l'app d'origine ; ici
// construit comme un véritable écran de CONFIGURATION (priorité opérateur + identifiants
// agrégateur), mais persisté uniquement en local (localStorage) — voir le composant pour le détail
// du gap de stockage serveur.
export default async function MobileMoneyPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.mobilemoney")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  return <MobileMoneyForm storeId={session.storeId} />;
}
