// Écran Documents — Factures, Proformas, Remboursements (§12 du cahier des charges).

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { chargerDocuments } from "@/components/documents/get-documents-data";
import { DocumentsClient } from "@/components/documents/documents-client";
import { formuleCourante } from "@/lib/abonnement";
import { formuleOuvre } from "@/lib/formules";
import { HorsFormule } from "@/components/abonnement/hors-formule";

export default async function DocumentsPage() {
  // Hors formule Essentiel : on présente ce que Premium apporte, au lieu d'un écran vide.
  // La route API correspondante refuse de son côté — masquer la page ne suffit pas.
  if (!formuleOuvre(await formuleCourante(), "documents")) return <HorsFormule fonctionnalite="documents" />;

  const session = await getSession();
  if (!session || !can(session.role, "documents.view")) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas accès à ce module.</p>
      </div>
    );
  }

  const canEdit = can(session.role, "documents.edit");

  // L'écran s'ouvre sur l'onglet Factures : le serveur le charge avec la page.
  const initial = await chargerDocuments(session.storeId, { type: "FACTURE" });

  return (
    <div className="space-y-4 p-4 pb-20 md:p-6 md:pb-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Factures, proformas et remboursements. Générez une facture depuis une vente existante, ou créez une
          proforma pour un client professionnel qui n&apos;a pas encore payé.
        </p>
      </div>
      <DocumentsClient initial={initial} canEdit={canEdit} />
    </div>
  );
}
