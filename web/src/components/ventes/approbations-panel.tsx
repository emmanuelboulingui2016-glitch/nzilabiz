"use client";

// Panneau "Demandes en attente" — §7 workflow d'approbation. Visible uniquement pour les
// utilisateurs disposant de la permission approbations.decider (Patron/Gérant). Liste les
// ApprovalRequest de type ANNULATION_VENTE en attente pour cette boutique, avec actions
// Approuver/Rejeter.

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatFcfa } from "@/lib/currency";
import type { ApprovalRequestRow } from "./types";

export function ApprobationsPanel({
  requests,
  onDecided,
}: {
  requests: ApprovalRequestRow[];
  onDecided: () => void;
}) {
  const [decidingId, setDecidingId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const decide = async (requestId: string, decision: "APPROUVER" | "REJETER") => {
    setDecidingId(requestId);
    try {
      const res = await fetch("/api/ventes/approbations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Action impossible.");
        return;
      }
      toast.success(decision === "APPROUVER" ? "Vente annulée." : "Demande rejetée.");
      onDecided();
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle size={16} />
          Demandes en attente ({requests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">
                Vente {r.sale?.numero ?? "—"} — {r.sale ? formatFcfa(r.sale.total) : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Demandé par {r.demandeParNom} · Motif : {r.motif ?? "—"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={decidingId === r.id}
                onClick={() => decide(r.id, "REJETER")}
              >
                Rejeter
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={decidingId === r.id}
                onClick={() => decide(r.id, "APPROUVER")}
              >
                Approuver
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
