"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatFcfa } from "@/lib/currency";
import type { ClientCreance, CreanceVente, DebtRepaymentRow } from "./types";

export function ClientDetailDialog({
  open,
  onClose,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<ClientCreance | null>(null);
  const [ventes, setVentes] = useState<CreanceVente[]>([]);
  const [remboursements, setRemboursements] = useState<DebtRepaymentRow[]>([]);

  useEffect(() => {
    if (!open || !clientId) return;
    setLoading(true);
    fetch(`/api/creances/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data.client ?? null);
        setVentes(data.ventes ?? []);
        setRemboursements(
          (data.remboursements ?? []).map((r: any) => ({ ...r, clientId: clientId!, clientNom: data.client?.nom ?? "" }))
        );
      })
      .finally(() => setLoading(false));
  }, [open, clientId]);

  return (
    <Dialog open={open} onClose={onClose} title={client ? `Historique — ${client.nom}` : "Historique client"} className="max-w-2xl">
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : !client ? (
        <p className="text-sm text-muted-foreground">Client introuvable.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-4 rounded-lg bg-muted p-3 text-sm">
            <div>
              <div className="text-muted-foreground">Solde</div>
              <div className="font-semibold">{formatFcfa(client.solde)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Limite de crédit</div>
              <div className="font-semibold">{client.limiteCredit !== null ? formatFcfa(client.limiteCredit) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Échéance</div>
              <div className="font-semibold">{client.echeanceEffective} j</div>
            </div>
            {client.joursRetard ? (
              <div>
                <Badge tone="danger">{client.joursRetard} j de retard</Badge>
              </div>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Ventes à crédit</h3>
            {ventes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente à crédit.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {ventes.map((v) => (
                  <li key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {v.numero} <span className="text-muted-foreground">· {new Date(v.dateHeure).toLocaleDateString("fr-FR")}</span>
                    </span>
                    <span className="font-medium">{formatFcfa(v.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Remboursements</h3>
            {remboursements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun remboursement enregistré.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {remboursements.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {new Date(r.date).toLocaleDateString("fr-FR")}{" "}
                      <span className="text-muted-foreground">· {r.mode === "ESPECES" ? "Espèces" : r.mode === "MOBILE_MONEY" ? "Mobile Money" : "Crédit"}</span>
                    </span>
                    <span className="font-medium text-success">{formatFcfa(r.montant)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
