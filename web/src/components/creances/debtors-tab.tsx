"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Pencil, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { formatFcfa } from "@/lib/currency";
import type { ClientCreance } from "./types";
import { ClientEditDialog } from "./client-edit-dialog";
import { RelanceDialog } from "./relance-dialog";
import { NewClientDialog } from "./new-client-dialog";
import { ClientDetailDialog } from "./client-detail-dialog";

export function DebtorsTab({ canEdit }: { canEdit: boolean }) {
  const [clients, setClients] = useState<ClientCreance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<ClientCreance | null>(null);
  const [relanceTarget, setRelanceTarget] = useState<ClientCreance | null>(null);
  const [detailTarget, setDetailTarget] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creances/clients");
      if (!res.ok) throw new Error("Impossible de charger les clients débiteurs");
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const debtors = useMemo(() => {
    return clients
      .filter((c) => c.solde > 0)
      .sort((a, b) => (b.joursRetard ?? -1) - (a.joursRetard ?? -1) || b.solde - a.solde);
  }, [clients]);

  const totalEnCours = useMemo(() => debtors.reduce((sum, c) => sum + c.solde, 0), [debtors]);
  const nbEnRetard = useMemo(() => debtors.filter((c) => (c.joursRetard ?? 0) > 0).length, [debtors]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total créances en cours" value={formatFcfa(totalEnCours)} />
        <StatCard label="Clients débiteurs" value={debtors.length} />
        <StatCard
          label="En retard"
          value={nbEnRetard}
          deltaTone={nbEnRetard > 0 ? "negative" : "neutral"}
          delta={nbEnRetard > 0 ? `${nbEnRetard} client(s) à relancer` : undefined}
        />
      </div>

      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowNewClient(true)}>
            <Plus size={16} /> Nouveau client
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : debtors.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun client débiteur pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {debtors.map((client) => (
            <Card key={client.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDetailTarget(client.id)}
                      className="truncate text-left font-semibold hover:underline"
                    >
                      {client.nom}
                    </button>
                    {client.joursRetard ? (
                      <Badge tone="danger">{client.joursRetard} j de retard</Badge>
                    ) : client.dateEcheance ? (
                      <Badge tone="success">À jour</Badge>
                    ) : null}
                    {client.depassementLimite ? <Badge tone="warning">Dépasse la limite</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {client.telephone ?? "Sans téléphone"} · Échéance {client.echeanceEffective} j
                    {client.limiteCredit !== null ? ` · Limite ${formatFcfa(client.limiteCredit)}` : ""}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatFcfa(client.solde)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" title="Historique" onClick={() => setDetailTarget(client.id)}>
                      <Eye size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Relancer" onClick={() => setRelanceTarget(client)}>
                      <MessageCircle size={16} />
                    </Button>
                    {canEdit ? (
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEditTarget(client)}>
                        <Pencil size={16} />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientEditDialog open={!!editTarget} onClose={() => setEditTarget(null)} client={editTarget} onSaved={load} />
      <RelanceDialog open={!!relanceTarget} onClose={() => setRelanceTarget(null)} client={relanceTarget} />
      <NewClientDialog open={showNewClient} onClose={() => setShowNewClient(false)} onCreated={load} />
      <ClientDetailDialog open={!!detailTarget} onClose={() => setDetailTarget(null)} clientId={detailTarget} />
    </div>
  );
}
