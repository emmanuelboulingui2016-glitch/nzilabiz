"use client";

import { useState } from "react";
import { Minus, Plus, Trash2, Wallet, Smartphone, HandCoins, Split, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatFcfa, parseFcfaInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { ClientPicker } from "./client-picker";
import type { CartLine, DiscountType, PaymentLine, PaymentMode, VendreClient } from "./types";

const MODE_OPTIONS: { value: PaymentMode; label: string; icon: typeof Wallet }[] = [
  { value: "ESPECES", label: "Espèces", icon: Wallet },
  { value: "MOBILE_MONEY", label: "Mobile Money", icon: Smartphone },
  { value: "CREDIT", label: "Crédit", icon: HandCoins },
];

/**
 * Une ligne de panier, extraite en composant à part pour le brouillon de saisie du prix.
 *
 * Le brouillon (`priceDraft`) est un `useState` local, initialisé une seule fois depuis
 * `line.prixUnitaire` au montage. Sans ce composant dédié, un `Record<productId, string>` tenu
 * dans `CartPanel` aurait dû être purgé à chaque retrait de ligne (retrait explicite, quantité
 * tombée à zéro, panier vidé après validation) pour ne pas réafficher une vieille saisie si le
 * même produit revient au panier plus tard — une purge qui n'a de sens que dans un effect
 * (`useEffect(() => setPriceDrafts(...), [lines])`), exactement le anti-pattern que la règle
 * `react-hooks/set-state-in-effect` du projet interdit (dériver un état depuis un autre au lieu de
 * le calculer au rendu). Ici, `key={line.productId}` sur cette ligne fait tout le travail : React
 * démonte l'instance quand la ligne quitte le panier et en remonte une neuve, avec un brouillon
 * frais, si le produit revient — aucune purge à écrire.
 */
function CartLineRow({
  line,
  canModifierPrix,
  onIncrement,
  onDecrement,
  onRemove,
  onPriceChange,
}: {
  line: CartLine;
  canModifierPrix: boolean;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onPriceChange: (productId: string, prixUnitaire: number) => void;
}) {
  // Tenu séparément de `line.prixUnitaire` : si le champ affichait directement la valeur numérique
  // reformatée à chaque frappe, effacer pour retaper (le vendeur négocie souvent à voix haute, en
  // tâtonnant) ferait sauter le champ à "0" ou au prix catalogue à chaque caractère effacé —
  // irritant au comptoir, sur un clavier tactile. Le brouillon garde exactement ce que le doigt a
  // tapé, y compris une saisie momentanément vide en cours d'édition.
  const [priceDraft, setPriceDraft] = useState(() => String(line.prixUnitaire));

  function handlePriceInput(raw: string) {
    setPriceDraft(raw);
    if (raw.trim() === "") return; // Saisie en cours, rien à propager tant que le champ est vide.
    const parsed = parseFcfaInput(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onPriceChange(line.productId, parsed);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{line.nom}</p>
        {canModifierPrix ? (
          // Champ toujours affiché (pas de bouton "modifier" à activer d'abord) : c'est le geste
          // le plus fréquent au comptoir, il ne doit pas coûter un tap de plus. Sans le droit,
          // aucun input ici — juste le texte figé ci-dessous, pas de bouton mort.
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 pl-1.5">
              <Pencil size={11} className="shrink-0 text-muted-foreground" aria-hidden />
              <Input
                type="text"
                inputMode="decimal"
                value={priceDraft}
                onChange={(e) => handlePriceInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-label={`Prix de vente de ${line.nom}`}
                className="h-7 w-20 border-0 bg-transparent px-1 text-xs font-semibold tabular-nums focus:ring-0"
              />
            </div>
            <span className="text-xs text-muted-foreground">/ {line.unite}</span>
            {line.prixUnitaire !== line.prixCatalogueUnitaire && (
              // Écart visible d'un coup d'œil, sans être une alarme : gris et discret, comme un
              // prix barré en vitrine, pas rouge/orange — le vendeur consent à ce prix, ce n'est
              // pas une erreur.
              <span className="text-[11px] text-muted-foreground line-through">
                {formatFcfa(line.prixCatalogueUnitaire)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {formatFcfa(line.prixUnitaire)} / {line.unite}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDecrement(line.productId)}
          aria-label="Diminuer la quantité"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground active:scale-95"
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantite}</span>
        <button
          type="button"
          onClick={() => onIncrement(line.productId)}
          aria-label="Augmenter la quantité"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground active:scale-95"
        >
          <Plus size={16} />
        </button>
      </div>
      <p className="w-20 shrink-0 text-right text-sm font-semibold">{formatFcfa(line.prixUnitaire * line.quantite)}</p>
      <button
        type="button"
        onClick={() => onRemove(line.productId)}
        aria-label="Retirer du panier"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function CartPanel({
  lines,
  onIncrement,
  onDecrement,
  onRemove,
  onPriceChange,
  canModifierPrix,

  remise,
  typeRemise,
  onRemiseChange,
  onTypeRemiseChange,

  sousTotal,
  remiseAmount,
  total,

  mixte,
  onToggleMixte,
  singleMode,
  onSingleModeChange,
  montantRecu,
  onMontantRecuChange,
  reference,
  onReferenceChange,

  mixedPayments,
  onMixedPaymentsChange,

  clients,
  clientId,
  onClientChange,
  onClientCreated,

  onSubmit,
  submitting,
  error,
}: {
  lines: CartLine[];
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  /** Modifie le prix pratiqué d'une ligne. N'est utilisé (et le champ n'est rendu) que si `canModifierPrix`. */
  onPriceChange: (productId: string, prixUnitaire: number) => void;
  /** `can(session.role, "vendre.prix.modifier")` côté serveur — pas un simple style, ça décide si le champ existe. */
  canModifierPrix: boolean;

  remise: number;
  typeRemise: DiscountType;
  onRemiseChange: (value: number) => void;
  onTypeRemiseChange: (value: DiscountType) => void;

  sousTotal: number;
  remiseAmount: number;
  total: number;

  mixte: boolean;
  onToggleMixte: () => void;
  singleMode: PaymentMode;
  onSingleModeChange: (mode: PaymentMode) => void;
  montantRecu: number | null;
  onMontantRecuChange: (value: number | null) => void;
  reference: string;
  onReferenceChange: (value: string) => void;

  mixedPayments: PaymentLine[];
  onMixedPaymentsChange: (rows: PaymentLine[]) => void;

  clients: VendreClient[];
  clientId: string | null;
  onClientChange: (id: string | null) => void;
  onClientCreated: (client: VendreClient) => void;

  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const requiresClient = mixte
    ? mixedPayments.some((p) => p.mode === "CREDIT")
    : singleMode === "CREDIT";

  const mixedSum = mixedPayments.reduce((s, p) => s + (p.montant || 0), 0);
  const mixedRemaining = total - mixedSum;

  const monnaie = montantRecu != null ? montantRecu - total : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Panier ({lines.length})</h2>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Le panier est vide. Touchez un produit pour l&apos;ajouter.
          </p>
        ) : (
          lines.map((line) => (
            <CartLineRow
              key={line.productId}
              line={line}
              canModifierPrix={canModifierPrix}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
              onPriceChange={onPriceChange}
            />
          ))
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-border pt-3">
        {/* Remise */}
        <div className="flex items-center gap-2">
          <Label className="mb-0 shrink-0 text-sm">Remise</Label>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            value={remise || ""}
            onChange={(e) => onRemiseChange(parseFcfaInput(e.target.value))}
            placeholder="0"
            className="h-10"
          />
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => onTypeRemiseChange("MONTANT")}
              className={cn("h-10 px-3 text-sm font-medium", typeRemise === "MONTANT" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground")}
            >
              FCFA
            </button>
            <button
              type="button"
              onClick={() => onTypeRemiseChange("POURCENTAGE")}
              className={cn("h-10 px-3 text-sm font-medium", typeRemise === "POURCENTAGE" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground")}
            >
              %
            </button>
          </div>
        </div>

        {/* Totaux */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Sous-total</span>
            <span>{formatFcfa(sousTotal)}</span>
          </div>
          {remiseAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Remise</span>
              <span>-{formatFcfa(remiseAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatFcfa(total)}</span>
          </div>
        </div>

        {/* Mode de paiement */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Mode de paiement</Label>
            <button
              type="button"
              onClick={onToggleMixte}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                mixte ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              <Split size={13} /> Paiement mixte
            </button>
          </div>

          {!mixte ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onSingleModeChange(value)}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium",
                      singleMode === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>

              {singleMode === "ESPECES" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="montant-recu" className="text-xs">Montant reçu</Label>
                    <Input
                      id="montant-recu"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={montantRecu ?? ""}
                      onChange={(e) => onMontantRecuChange(e.target.value === "" ? null : parseFcfaInput(e.target.value))}
                      placeholder={String(total)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Monnaie à rendre</Label>
                    <p className={cn("flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm font-semibold", monnaie != null && monnaie < 0 ? "text-danger" : "text-success")}>
                      {formatFcfa(monnaie != null ? Math.max(0, monnaie) : 0)}
                    </p>
                  </div>
                </div>
              )}

              {singleMode === "MOBILE_MONEY" && (
                <div>
                  <Label htmlFor="reference-mm" className="text-xs">Référence (optionnel)</Label>
                  <Input
                    id="reference-mm"
                    value={reference}
                    onChange={(e) => onReferenceChange(e.target.value)}
                    placeholder="Ex : réf. transaction"
                    className="h-10"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {mixedPayments.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Select
                    value={p.mode}
                    onChange={(e) => {
                      const next = [...mixedPayments];
                      next[i] = { ...next[i], mode: e.target.value as PaymentMode };
                      onMixedPaymentsChange(next);
                    }}
                    className="h-10 w-36 shrink-0"
                  >
                    <option value="ESPECES">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CREDIT">Crédit</option>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={p.montant || ""}
                    onChange={(e) => {
                      const next = [...mixedPayments];
                      next[i] = { ...next[i], montant: parseFcfaInput(e.target.value) };
                      onMixedPaymentsChange(next);
                    }}
                    placeholder="Montant"
                    className="h-10 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => onMixedPaymentsChange(mixedPayments.filter((_, idx) => idx !== i))}
                    aria-label="Retirer ce paiement"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onMixedPaymentsChange([...mixedPayments, { mode: "ESPECES", montant: Math.max(0, mixedRemaining) }])}
              >
                + Ajouter un mode
              </Button>
              <p className={cn("text-xs", mixedRemaining === 0 ? "text-success" : "text-muted-foreground")}>
                Restant à répartir : {formatFcfa(Math.max(0, mixedRemaining))}
              </p>
            </div>
          )}
        </div>

        {/* Client */}
        <ClientPicker
          clients={clients}
          clientId={clientId}
          onClientChange={onClientChange}
          onClientCreated={onClientCreated}
          requis={requiresClient}
        />

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="button" size="lg" className="h-14 w-full text-base" disabled={submitting || lines.length === 0} onClick={onSubmit}>
          {submitting ? "Validation…" : "Valider la vente"}
        </Button>
      </div>
    </div>
  );
}
