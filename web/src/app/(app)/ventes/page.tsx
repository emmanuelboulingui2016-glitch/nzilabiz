// Écran Ventes — historique (§7 du cahier des charges).

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chargerVentes } from "@/components/ventes/get-ventes-data";
import { VentesClient } from "@/components/ventes/ventes-client";

export default async function VentesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const canViewAll = can(session.role, "ventes.view.all");
  const canViewOwn = can(session.role, "ventes.view.own");
  if (!canViewAll && !canViewOwn) redirect("/dashboard");

  // L'écran s'ouvre sur « Aujourd'hui » : le serveur charge donc cette période avec la page, et le
  // navigateur n'a plus rien à redemander tant que l'utilisateur ne change pas de filtre.
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date();
  finJour.setHours(23, 59, 59, 999);

  const initial = await chargerVentes(
    { storeId: session.storeId, userId: session.userId, canViewAll },
    { from: debutJour.toISOString(), to: finJour.toISOString() }
  );

  return (
    <VentesClient
      initial={initial}
      canAnnulerDirect={can(session.role, "ventes.annuler.direct")}
      canAnnulerDemander={can(session.role, "ventes.annuler.demander")}
      canDecider={can(session.role, "approbations.decider")}
      canViewAll={canViewAll}
    />
  );
}
