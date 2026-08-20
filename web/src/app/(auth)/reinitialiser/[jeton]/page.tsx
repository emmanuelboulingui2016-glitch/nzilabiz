import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, TriangleAlert } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { messageJetonInvalide, verifierJeton } from "@/lib/auth/reset-token";

// Le jeton est dans l'adresse : cette page ne doit jamais être mise en cache ni pré-générée, et
// surtout pas indexée par un moteur de recherche.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — NzilaBiz",
  robots: { index: false, follow: false },
};

// Le jeton est vérifié ici, avant d'afficher quoi que ce soit, mais il n'est pas consommé : un lien
// périmé doit s'expliquer sans faire remplir un formulaire pour rien. La consommation a lieu à
// l'enregistrement du nouveau mot de passe, côté serveur.
export default async function ReinitialiserPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const v = await verifierJeton(decodeURIComponent(jeton));

  if (!v.ok) {
    return (
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <TriangleAlert size={18} className="text-warning" /> Lien inutilisable
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">{messageJetonInvalide(v.raison)}</p>
        <div className="flex flex-col gap-2">
          <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-primary hover:underline">
            Demander un nouveau lien
          </Link>
          <Link href="/connexion" className="text-sm text-muted-foreground hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <KeyRound size={18} /> Nouveau mot de passe
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Pour le compte <strong className="text-foreground">{v.jeton.email}</strong>.
      </p>
      <ResetPasswordForm jeton={decodeURIComponent(jeton)} />
    </div>
  );
}
