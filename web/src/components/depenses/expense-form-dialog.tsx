"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui";
import { parseFcfaInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  type Expense,
  type ExpenseFrequence,
  type PaymentMode,
  MODE_REGLEMENT_LABELS,
  splitDescription,
} from "./types";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 Mo — la pièce jointe est stockée en data URL en base, pas de service de fichiers.
const NOUVELLE_CATEGORIE = "__nouvelle__";

function todayInputValue() {
  const now = new Date();
  const tz = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export function ExpenseFormDialog({
  open,
  onClose,
  onSaved,
  suggestedCategories,
  existingCategories,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  suggestedCategories: string[];
  existingCategories: string[];
  expense: Expense | null;
}) {
  const isEdit = Boolean(expense);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...suggestedCategories, ...existingCategories]);
    set.delete("Rachats de stock");
    return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
  }, [suggestedCategories, existingCategories]);

  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [categorieChoice, setCategorieChoice] = useState<string>("");
  const [categorieLibre, setCategorieLibre] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [modeReglement, setModeReglement] = useState<PaymentMode>("ESPECES");
  const [note, setNote] = useState("");
  const [recurrente, setRecurrente] = useState(false);
  const [frequence, setFrequence] = useState<ExpenseFrequence>("MENSUELLE");
  const [pieceJointeUrl, setPieceJointeUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      const { libelle: l, note: n } = splitDescription(expense.description);
      setLibelle(l);
      setNote(n);
      setMontant(String(Number(expense.montant)));
      if (categoryOptions.includes(expense.categorie)) {
        setCategorieChoice(expense.categorie);
        setCategorieLibre("");
      } else {
        setCategorieChoice(NOUVELLE_CATEGORIE);
        setCategorieLibre(expense.categorie);
      }
      setDate(expense.date.slice(0, 10));
      setModeReglement(expense.modeReglement);
      setRecurrente(expense.recurrente);
      setFrequence(expense.frequence ?? "MENSUELLE");
      setPieceJointeUrl(expense.pieceJointeUrl);
    } else {
      setLibelle("");
      setNote("");
      setMontant("");
      setCategorieChoice("");
      setCategorieLibre("");
      setDate(todayInputValue());
      setModeReglement("ESPECES");
      setRecurrente(false);
      setFrequence("MENSUELLE");
      setPieceJointeUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("La photo est trop volumineuse (max 2 Mo).");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPieceJointeUrl(String(reader.result));
    };
    reader.onerror = () => toast.error("Impossible de lire le fichier sélectionné.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const categorie = categorieChoice === NOUVELLE_CATEGORIE ? categorieLibre.trim() : categorieChoice;
    if (!libelle.trim()) return toast.error("Le libellé est requis");
    const montantNum = parseFcfaInput(montant);
    if (!montantNum || montantNum <= 0) return toast.error("Le montant doit être supérieur à 0");
    if (!categorie) return toast.error("Choisissez ou saisissez une catégorie");

    setSubmitting(true);
    try {
      const payload = {
        libelle: libelle.trim(),
        montant: montantNum,
        categorie,
        date,
        modeReglement,
        note: note.trim(),
        recurrente,
        frequence: recurrente ? frequence : null,
        pieceJointeUrl,
      };
      const res = await fetch(isEdit ? `/api/depenses/${expense!.id}` : "/api/depenses", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success(isEdit ? "Dépense mise à jour" : "Dépense ajoutée");
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Modifier la dépense" : "Ajouter une dépense"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="libelle">Libellé</Label>
          <Input
            id="libelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Loyer boutique, Facture Internet…"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="montant">Montant (FCFA)</Label>
            <Input
              id="montant"
              inputMode="numeric"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="0"
              required
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>

        <div>
          <Label htmlFor="categorie">Catégorie</Label>
          <Select
            id="categorie"
            value={categorieChoice}
            onChange={(e) => setCategorieChoice(e.target.value)}
            required
          >
            <option value="" disabled>
              Choisir une catégorie…
            </option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NOUVELLE_CATEGORIE}>+ Nouvelle catégorie…</option>
          </Select>
          {categorieChoice === NOUVELLE_CATEGORIE ? (
            <Input
              className="mt-2"
              value={categorieLibre}
              onChange={(e) => setCategorieLibre(e.target.value)}
              placeholder="Nom de la nouvelle catégorie"
              required
            />
          ) : null}
        </div>

        <div>
          <Label htmlFor="mode">Mode de règlement</Label>
          <Select id="mode" value={modeReglement} onChange={(e) => setModeReglement(e.target.value as PaymentMode)}>
            {(Object.keys(MODE_REGLEMENT_LABELS) as PaymentMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_REGLEMENT_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="note">Note (optionnel)</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Détails, fournisseur, référence…" />
        </div>

        <div className="rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={recurrente}
              onChange={(e) => setRecurrente(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Dépense récurrente
          </label>
          {recurrente ? (
            <div className="mt-3">
              <Label htmlFor="frequence">Fréquence</Label>
              <Select id="frequence" value={frequence} onChange={(e) => setFrequence(e.target.value as ExpenseFrequence)}>
                <option value="HEBDOMADAIRE">Hebdomadaire</option>
                <option value="MENSUELLE">Mensuelle</option>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                La prochaine occurrence sera générée automatiquement (à l&apos;ouverture de la page Dépenses)
                dès que l&apos;intervalle sera écoulé.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <Label htmlFor="piece-jointe">Photo du reçu / facture (optionnel)</Label>
          <input
            id="piece-jointe"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className={cn(
              "block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border"
            )}
          />
          {pieceJointeUrl ? (
            <div className="mt-2 flex items-center gap-2">
              {pieceJointeUrl.startsWith("data:image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pieceJointeUrl} alt="Aperçu" className="h-14 w-14 rounded-lg border border-border object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">Fichier joint</span>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setPieceJointeUrl(null)}>
                Retirer
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
