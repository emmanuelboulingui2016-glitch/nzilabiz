import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { MobileMoneyForm } from "@/components/parametres/mobile-money/mobile-money-form";
import { formuleCourante } from "@/lib/abonnement";
import { formuleOuvre } from "@/lib/formules";
import { HorsFormule } from "@/components/abonnement/hors-formule";

// Onglet Mobile Money — §14 + §16 🔧. Marqué « arrive bientôt » dans l'app d'origine ; ici
// construit comme un véritable écran de configuration (priorité opérateur + identifiants
// agrégateur), persisté en base pour toute la boutique. Le paiement réel reste à brancher.
export default async function MobileMoneyPage() {
  // Hors formule Essentiel : on présente ce que Premium apporte, au lieu d'un écran vide.
  // La route API correspondante refuse de son côté — masquer la page ne suffit pas.
  if (!formuleOuvre(await formuleCourante(), "mobilemoney")) return <HorsFormule fonctionnalite="mobilemoney" />;

  const session = await getSession();
  if (!session) redirect("/connexion");
  if (!can(session.role, "parametres.mobilemoney")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Vous n&apos;avez pas accès à ce réglage.
      </div>
    );
  }

  return <MobileMoneyForm />;
}
