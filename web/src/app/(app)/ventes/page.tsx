// Écran Ventes — historique (§7 du cahier des charges).

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { VentesClient } from "@/components/ventes/ventes-client";

export default async function VentesPage() {
  const session = await getSession();
  if (!session) redirect("/connexion");

  const canViewAll = can(session.role, "ventes.view.all");
  const canViewOwn = can(session.role, "ventes.view.own");
  if (!canViewAll && !canViewOwn) redirect("/dashboard");

  return (
    <VentesClient
      canAnnulerDirect={can(session.role, "ventes.annuler.direct")}
      canAnnulerDemander={can(session.role, "ventes.annuler.demander")}
      canDecider={can(session.role, "approbations.decider")}
      canViewAll={canViewAll}
    />
  );
}
