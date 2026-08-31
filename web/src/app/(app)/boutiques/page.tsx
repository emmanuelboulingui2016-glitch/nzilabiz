import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { etatBoutiqueCourante } from "@/lib/abonnement";
import { boutiquesAccessibles, chiffresDesBoutiques, MAX_BOUTIQUES_RESEAU } from "@/lib/reseau";
import { getPlatformSettings, contactCommercial } from "@/lib/platform-settings";
import { ReseauView } from "@/components/reseau/reseau-view";

export const metadata: Metadata = { title: "Mes boutiques — NzilaBiz" };

/**
 * Vue d'ensemble du réseau — formule Entreprise.
 *
 * Accessible au patron quelle que soit sa formule : sur une boutique seule, l'écran présente ce
 * que la formule apporte et comment l'obtenir. Cacher entièrement la page à ceux qui n'y ont pas
 * droit reviendrait à vendre une fonctionnalité que personne ne peut voir.
 *
 * Requêtes enchaînées, jamais en parallèle : le pooler en mode transaction ne rend pas la main
 * quand plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
 */
export default async function BoutiquesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  if (!can(session.role, "boutiques.reseau")) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Seul le patron peut gérer les boutiques du réseau.
      </div>
    );
  }

  const etat = await etatBoutiqueCourante();
  const boutiques = await boutiquesAccessibles(session.userId);
  const chiffres = await chiffresDesBoutiques(boutiques.map((b) => b.id));
  const reglages = await getPlatformSettings();

  const entreprise = etat?.plan === "ENTREPRISE";

  return (
    <ReseauView
      plan={etat?.plan ?? "ESSAI"}
      entreprise={entreprise}
      peutAjouter={entreprise && boutiques.length < MAX_BOUTIQUES_RESEAU}
      maximum={MAX_BOUTIQUES_RESEAU}
      contact={contactCommercial(reglages)}
      boutiques={boutiques.map((b) => ({
        id: b.id,
        nom: b.nom,
        role: b.role,
        active: b.id === session.storeId,
        maisonMere: b.id === b.contratId,
        chiffres: chiffres.get(b.id) ?? { caJour: 0, ventesJour: 0, caMois: 0, stockBas: 0 },
      }))}
    />
  );
}
