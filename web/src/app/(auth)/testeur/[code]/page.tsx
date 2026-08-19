import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { verifierCodeTest, messageRefus } from "@/lib/test-access";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Accès testeur — NzilaBiz",
  description: "Créez votre boutique et accédez à tous les modules pendant la période de test.",
  // Un lien de test n'a rien à faire dans les moteurs de recherche : il circule de la main à la main.
  robots: { index: false, follow: false },
};

const MODULES = [
  "Caisse et ventes",
  "Stock et alertes",
  "Clients et fidélité",
  "Créances et relances",
  "Dépenses et caisse",
  "Factures et proformas",
  "Rapports et tableaux de bord",
  "Employés et rôles",
];

export default async function TesteurPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const acces = await verifierCodeTest(decodeURIComponent(code));

  if (!acces.valide) {
    return (
      <div className="text-center">
        <XCircle size={40} className="mx-auto mb-3 text-danger" />
        <h2 className="mb-2 text-lg font-semibold">Lien indisponible</h2>
        <p className="mb-5 text-sm text-muted-foreground">{messageRefus(acces.raison)}</p>
        <Link href="/inscription">
          <Button variant="outline" className="w-full">
            Créer une boutique normalement
          </Button>
        </Link>
      </div>
    );
  }

  const fin = acces.expireLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-primary">
          <CheckCircle2 size={16} /> Accès testeur validé
        </p>
        <p className="mt-1.5 text-sm">
          Créez votre boutique ci-dessous : <strong>tous les modules sont ouverts, sans paiement,
          jusqu&apos;au {fin}</strong>.
        </p>
        <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {MODULES.map((m) => (
            <li key={m} className="flex items-center gap-1.5">
              <span className="text-primary">✓</span> {m}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Aucune carte bancaire n&apos;est demandée. Vos données de test vous appartiennent : vous
          pourrez les conserver ou supprimer votre compte à la fin de la période.
        </p>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Créez votre boutique</h2>
      <RegisterForm codeTest={decodeURIComponent(code)} />
    </div>
  );
}
