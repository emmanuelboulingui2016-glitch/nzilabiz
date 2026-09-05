import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, TriangleAlert } from "lucide-react";
import { ConfirmerEmailForm } from "@/components/auth/confirmer-email-form";
import { messageJetonVerificationInvalide, verifierJetonVerification } from "@/lib/auth/email-verification-token";

// Le jeton est dans l'adresse : cette page ne doit jamais être mise en cache ni pré-générée, et
// surtout pas indexée par un moteur de recherche.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmer votre adresse e-mail — NzilaBiz",
  robots: { index: false, follow: false },
};

// Le jeton est vérifié ici, avant d'afficher quoi que ce soit, mais il n'est pas consommé : un lien
// périmé doit s'expliquer sans rien déclencher. La confirmation elle-même est un geste explicite
// (bouton → POST), voir ConfirmerEmailForm — jamais l'ouverture de cette page en elle-même.
export default async function VerifierEmailPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const v = await verifierJetonVerification(decodeURIComponent(jeton));

  if (!v.ok) {
    return (
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <TriangleAlert size={18} className="text-warning" /> Lien inutilisable
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">{messageJetonVerificationInvalide(v.raison)}</p>
        <p className="text-xs text-muted-foreground">
          Vous pouvez en redemander un depuis Paramètres → Mon compte, une fois connecté.
        </p>
        <Link href="/connexion" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  const estChangement = v.jeton.type === "CHANGEMENT_EMAIL";

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <MailCheck size={18} /> {estChangement ? "Confirmer la nouvelle adresse" : "Confirmer votre adresse"}
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Pour <strong className="text-foreground">{v.jeton.email}</strong>.
      </p>
      <ConfirmerEmailForm jeton={decodeURIComponent(jeton)} changement={estChangement} />
    </div>
  );
}
