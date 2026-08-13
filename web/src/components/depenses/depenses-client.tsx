"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Select, StatCard } from "@/components/ui";
import { formatFcfa } from "@/lib/currency";
import { ExpenseAttachmentThumb } from "./expense-attachment";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { MODE_REGLEMENT_LABELS, splitDescription, type Expense, type ExpensesResponse } from "./types";

const PERIODE_OPTIONS: { value: string; label: string }[] = [
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "semaine", label: "Cette semaine" },
  { value: "mois", label: "Ce mois" },
  { value: "annee", label: "Cette année" },
  { value: "tout", label: "Tout" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function DepensesClient({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState("mois");
  const [categorie, setCategorie] = useState("");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const hasNotifiedGeneration = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("periode", periode);
      if (categorie) params.set("categorie", categorie);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/depenses?${params.toString()}`);
      if (!res.ok) {
        toast.error("Impossible de charger les dépenses");
        return;
      }
      const json = (await res.json()) as ExpensesResponse;
      setData(json);
      if (json.generatedRecurringCount > 0 && !hasNotifiedGeneration.current) {
        hasNotifiedGeneration.current = true;
        toast.success(
          `${json.generatedRecurringCount} dépense(s) récurrente(s) générée(s) automatiquement pour l'échéance du jour`
        );
      }
    } finally {
      setLoading(false);
    }
  }, [periode, categorie, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function handleDelete(expense: Expense) {
    if (expense.stockReceiptId) return;
    if (!confirm(`Supprimer la dépense « ${splitDescription(expense.description).libelle} » ?`)) return;
    const res = await fetch(`/api/depenses/${expense.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error ?? "Suppression impossible");
      return;
    }
    toast.success("Dépense supprimée");
    load();
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total ce mois" value={formatFcfa(kpis?.totalMois ?? 0)} />
        <StatCard
          label="Rachats de stock (mois)"
          value={formatFcfa(kpis?.rachatsStockMois ?? 0)}
          helpText="Généré depuis Stock (Réceptionner une livraison). Déjà compté dans le coût des produits vendus : exclu du calcul du bénéfice net dans Rapports."
        />
        <StatCard
          label="Autres dépenses (mois)"
          value={formatFcfa(kpis?.autresDepensesMois ?? 0)}
          helpText="Dépenses saisies manuellement ici. Comptées dans le calcul du bénéfice net."
        />
        <StatCard label="Aujourd'hui" value={formatFcfa(kpis?.aujourdHui ?? 0)} />
        <StatCard label="Transactions" value={kpis?.transactionsMois ?? 0} />
        <StatCard label="Plus grosse charge" value={formatFcfa(kpis?.plusGrosseChargeMois ?? 0)} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={periode} onChange={(e) => setPeriode(e.target.value)} className="sm:w-40">
              {PERIODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="sm:w-48">
              <option value="">Toutes les catégories</option>
              {(data?.categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un libellé, une catégorie…"
                className="pl-9"
              />
            </div>
          </div>
          {canEdit ? (
            <Button
              onClick={() => {
                setEditingExpense(null);
                setDialogOpen(true);
              }}
              className="shrink-0"
            >
              <Plus size={16} />
              Ajouter une dépense
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Libellé</th>
                <th className="px-4 py-2 font-medium">Catégorie</th>
                <th className="px-4 py-2 font-medium">Mode</th>
                <th className="px-4 py-2 font-medium">Pièce jointe</th>
                <th className="px-4 py-2 text-right font-medium">Montant</th>
                {canEdit ? <th className="px-4 py-2 text-right font-medium">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : (data?.expenses.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune dépense pour cette sélection.
                  </td>
                </tr>
              ) : (
                data!.expenses.map((expense) => {
                  const { libelle, note } = splitDescription(expense.description);
                  const isStock = Boolean(expense.stockReceiptId);
                  return (
                    <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{libelle}</div>
                        {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
                        {expense.recurrente ? (
                          <Badge tone="info" className="mt-1">
                            Récurrente
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {isStock ? (
                          <div className="flex flex-col gap-1">
                            <Badge tone="warning" className="w-fit gap-1">
                              <Package size={12} /> Rachat de stock
                            </Badge>
                            <span className="text-xs text-muted-foreground" title="Cette dépense a été créée automatiquement par le module Stock">
                              Généré depuis une réception de stock
                            </span>
                          </div>
                        ) : (
                          <Badge tone="neutral">{expense.categorie}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{MODE_REGLEMENT_LABELS[expense.modeReglement]}</td>
                      <td className="px-4 py-3">
                        {expense.pieceJointeUrl ? <ExpenseAttachmentThumb url={expense.pieceJointeUrl} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatFcfa(expense.montant)}</td>
                      {canEdit ? (
                        <td className="px-4 py-3 text-right">
                          {isStock ? (
                            <span className="text-xs text-muted-foreground">Lecture seule</span>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setDialogOpen(true);
                                }}
                                aria-label="Modifier"
                              >
                                <Pencil size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(expense)} aria-label="Supprimer">
                                <Trash2 size={16} className="text-danger" />
                              </Button>
                            </div>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {canEdit ? (
        <ExpenseFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSaved={load}
          suggestedCategories={data?.suggestedCategories ?? []}
          existingCategories={data?.categories ?? []}
          expense={editingExpense}
        />
      ) : null}
    </div>
  );
}
