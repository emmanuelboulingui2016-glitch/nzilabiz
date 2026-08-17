import Link from "next/link";
import type { ReactNode } from "react";

// Mise en page commune aux documents légaux. La typographie est définie ici plutôt que dans chaque
// page pour que les quatre documents restent visuellement cohérents.
export function LegalLayout({
  titre,
  miseAJour,
  intro,
  children,
}: {
  titre: string;
  miseAJour: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{titre}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Dernière mise à jour : {miseAJour}</p>
      {intro ? <p className="mt-4 text-base text-muted-foreground">{intro}</p> : null}

      <div
        className={[
          "mt-8 space-y-6",
          "[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight",
          "[&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-bold",
          "[&_p]:mt-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground",
          "[&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ul]:text-sm [&_ul]:text-muted-foreground",
          "[&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ol]:text-sm [&_ol]:text-muted-foreground",
          "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline",
          "[&_strong]:text-foreground",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

// Encadré signalant une information que l'éditeur doit renseigner avant la mise en ligne : mieux
// vaut un champ visiblement vide qu'une mention légale inventée.
export function AComplete({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-warning/15 px-1.5 py-0.5 font-semibold text-warning">
      [à compléter : {children}]
    </span>
  );
}
