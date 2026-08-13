"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFcfa } from "@/lib/currency";
import type { ClientCreance, DebtRepaymentRow } from "./types";
import { RecordRepaymentDialog } from "./record-repayment-dialog";

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  CREDIT: "Crédit",
};

export function RepaymentsTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<DebtRepaymentRow[]>([]);
  const [clients, setClients] = useState<ClientCreance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecord, setShowRecord] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [repRes, clientsRes] = await Promise.all([
        fetch("/api/creances/remboursements"),
        fetch("/api/creances/clients"),
      ]);
      if (!repRes.ok) throw new Error("Impossible de charger les remboursements");
      const repData = await repRes.json();
      setRows(repData.remboursements ?? []);
      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData.clients ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRecu = rows.reduce((sum, r) => sum + r.montant, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} remboursement(s) · Total reçu : <span className="font-semibold text-foreground">{formatFcfa(totalRecu)}</span>
        </p>
        {canEdit ? (
          <Button size="sm" onClick={() => setShowRecord(true)}>
            <Plus size={16} /> Enregistrer un remboursement
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun remboursement enregistré pour le moment.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Client</th>
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Vente liée</th>
                  <th className="px-4 py-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2">{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2">{r.clientNom}</td>
                    <td className="px-4 py-2">{MODE_LABELS[r.mode] ?? r.mode}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.saleNumero ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold text-success">{formatFcfa(r.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <RecordRepaymentDialog
        open={showRecord}
        onClose={() => setShowRecord(false)}
        clients={clients}
        onSaved={load}
      />
    </div>
  );
}
