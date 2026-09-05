"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import type { DonneesVendre } from "@/components/vendre/get-vendre-data";
import { toast } from "sonner";
import { WifiOff } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { formatFcfa } from "@/lib/currency";
import {
  offlineDb,
  enqueueMutation,
  getOrCreateDeviceId,
  appartientALaBoutique,
  type OfflineSale,
} from "@/lib/offline/db";
import { runSync } from "@/lib/offline/sync-engine";
import { amorcerCacheLocal, toVendreProduct } from "./cache-local";
import { ProductGrid } from "./product-grid";
import { CartPanel } from "./cart-panel";
import { ReceiptView } from "./receipt-view";
import { BarcodeScannerDialog } from "./barcode-scanner-dialog";
import type {
  CartLine,
  DiscountType,
  PaymentLine,
  PaymentMode,
  ReceiptData,
  VendreCategory,
  VendreClient,
  VendreProduct,
} from "./types";

export function VendreScreen({
  initial,
  storeId,
  userId,
  storeName,
  canModifierPrix,
}: {
  /** Catalogue, catégories et clients rendus par le serveur avec la page. */
  initial: DonneesVendre;
  storeId: string;
  userId: string;
  storeName: string;
  /**
   * `can(session.role, "vendre.prix.modifier")`, calculé côté serveur par la page qui rend cet
   * écran. Une interface qui masque juste le champ ne serait pas une sécurité : le serveur revalide
   * ce même droit à l'enregistrement (POST /api/vendre et /api/vendre/sync). Ce booléen ne pilote
   * donc que l'affichage — s'il ment (état front désynchronisé), la pire conséquence est un champ
   * visible pour rien, jamais un prix accepté à tort.
   */
  canModifierPrix: boolean;
}) {
  // Catalogue
  const [products, setProducts] = useState<VendreProduct[]>(initial.products as VendreProduct[]);
  const [categories, setCategories] = useState<VendreCategory[]>(initial.categories as VendreCategory[]);
  const [clients, setClients] = useState<VendreClient[]>(initial.clients as VendreClient[]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("TOUS");
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  // Panier
  const [cart, setCart] = useState<CartLine[]>([]);
  const [remise, setRemise] = useState(0);
  const [typeRemise, setTypeRemise] = useState<DiscountType>("MONTANT");
  const [cartDialogOpen, setCartDialogOpen] = useState(false);

  // Paiement
  const [mixte, setMixte] = useState(false);
  const [singleMode, setSingleMode] = useState<PaymentMode>("ESPECES");
  const [montantRecu, setMontantRecu] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [mixedPayments, setMixedPayments] = useState<PaymentLine[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  // Validation / réseau
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const deviceIdRef = useRef<string>("");

  // --- Réseau / synchro hors-ligne ---------------------------------------
  useEffect(() => {
    deviceIdRef.current = getOrCreateDeviceId();
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Le moteur de synchronisation démarre désormais dans `AppShell`, au-dessus de toutes les
    // pages. Le lancer ici seulement laissait sans synchro le vendeur qui saisissait une vente
    // hors connexion puis quittait la caisse : ses ventes restaient dans le téléphone, y compris
    // après le retour du réseau. C'est le défaut qui coûtait le plus cher — il perdait des ventes
    // déjà encaissées, sans rien dire.
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Réconcilie périodiquement les ventes locales marquées `synced:false` dont la mutation en file
  // a fini par être traitée par le moteur de synchro en arrière-plan (hors du parcours immédiat).
  useEffect(() => {
    const reconcile = async () => {
      const localSales = await offlineDb.sales.where("storeId").equals(storeId).toArray();
      const unsynced = localSales.filter((s) => !s.synced);
      setPendingSyncCount(unsynced.length);
      for (const sale of unsynced) {
        const stillQueued = await offlineDb.syncQueue.where("entiteId").equals(sale.id).count();
        if (stillQueued === 0) {
          await offlineDb.sales.update(sale.id, { synced: true });
        }
      }
    };
    void reconcile();
    const interval = window.setInterval(() => void reconcile(), 15_000);
    return () => window.clearInterval(interval);
  }, [storeId]);

  // --- Chargement du catalogue --------------------------------------------
  const loadProducts = useCallback(
    async (opts: { q: string; categoryId: string }) => {
      setLoadingProducts(true);
      try {
        const params = new URLSearchParams();
        if (opts.q) params.set("q", opts.q);
        if (opts.categoryId && opts.categoryId !== "TOUS") params.set("categoryId", opts.categoryId);
        const res = await fetch(`/api/vendre/produits?${params.toString()}`);
        if (!res.ok) throw new Error("network");
        const data = await res.json();
        setProducts(data.products);
        setCategories(data.categories);
        setClients(data.clients);
        await amorcerCacheLocal(data.products as VendreProduct[]);
      } catch {
        // Hors-ligne ou erreur réseau : repli sur le cache local IndexedDB (best effort).
        const cached = await offlineDb.products.where("storeId").equals(storeId).toArray();
        const q = opts.q.trim().toLowerCase();
        const filtered = cached.filter((p) => {
          const matchesCategory = opts.categoryId === "TOUS" || !opts.categoryId || p.categoryId === opts.categoryId;
          const matchesSearch =
            !q || p.nom.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q) || p.codeBarres?.includes(q);
          return matchesCategory && matchesSearch;
        });
        setProducts(filtered.map(toVendreProduct));
        if (cached.length === 0) {
          toast.error("Impossible de charger les produits (hors-ligne, aucun cache disponible).");
        }
      } finally {
        setLoadingProducts(false);
      }
    },
    [storeId]
  );

  // Le premier passage est ignoré : la grille est déjà celle rendue par le serveur. Le cache
  // hors-ligne est tout de même amorcé à partir de ces mêmes données, sans appel réseau — sans quoi
  // un vendeur qui ouvre la caisse puis perd le réseau se retrouverait devant un cache vide.
  // Les passages suivants correspondent à une recherche ou à un changement de catégorie ; le délai
  // de 250 ms n'a de sens que pour la frappe.
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      void amorcerCacheLocal(initial.products as VendreProduct[]);
      return;
    }
    const timeout = window.setTimeout(() => void loadProducts({ q: search, categoryId }), 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, loadProducts]);

  // --- Panier ---------------------------------------------------------------
  const addProduct = useCallback((product: VendreProduct) => {
    const stock = Number(product.quantiteStock);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const currentQty = existing?.quantite ?? 0;
      if (stock > 0 && currentQty + 1 > stock) {
        toast.error("Stock insuffisant pour ce produit.");
        return prev;
      }
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          nom: product.nom,
          prixUnitaire: Number(product.prixVente),
          prixCatalogueUnitaire: Number(product.prixVente),
          prixAchatUnitaire: Number(product.prixAchat),
          quantite: 1,
          stockDisponible: stock,
          unite: product.unite,
        },
      ];
    });
  }, []);

  // Modification du prix d'une ligne à la caisse (§ demande produit du 04/09). N'est appelée que
  // si `canModifierPrix` (le champ n'est même pas rendu sinon, voir cart-panel.tsx) — mais on
  // clampe quand même ici en dernier recours : le serveur revalidera de toute façon à
  // l'enregistrement, cette borne n'est qu'un confort d'affichage immédiat du panier.
  const updatePrice = useCallback((productId: string, prixUnitaire: number) => {
    if (!Number.isFinite(prixUnitaire) || prixUnitaire < 0) return;
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, prixUnitaire: Math.round(prixUnitaire) } : l))
    );
  }, []);

  const increment = useCallback((productId: string) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l;
        if (l.stockDisponible > 0 && l.quantite + 1 > l.stockDisponible) {
          toast.error("Stock insuffisant pour ce produit.");
          return l;
        }
        return { ...l, quantite: l.quantite + 1 };
      })
    );
  }, []);

  const decrement = useCallback((productId: string) => {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantite: l.quantite - 1 } : l)).filter((l) => l.quantite > 0)
    );
  }, []);

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const addByBarcode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;
      const local = products.find((p) => p.codeBarres === code);
      if (local) {
        addProduct(local);
        setBarcode("");
        return;
      }
      try {
        const res = await fetch(`/api/vendre/produits?codeBarres=${encodeURIComponent(code)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.products?.length) {
            addProduct(data.products[0]);
            setBarcode("");
            return;
          }
        }
      } catch {
        const cached = await offlineDb.products.where("codeBarres").equals(code).first();
        if (cached) {
          addProduct(toVendreProduct(cached));
          setBarcode("");
          return;
        }
      }
      toast.error("Produit introuvable pour ce code-barres.");
    },
    [products, addProduct]
  );

  // --- Totaux -----------------------------------------------------------
  const sousTotal = useMemo(() => Math.round(cart.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0)), [cart]);
  const remiseAmount = useMemo(() => {
    const amount = typeRemise === "POURCENTAGE" ? (sousTotal * remise) / 100 : remise;
    return Math.min(Math.max(0, Math.round(amount)), sousTotal);
  }, [sousTotal, remise, typeRemise]);
  const total = Math.max(0, sousTotal - remiseAmount);

  const effectivePayments = useMemo<PaymentLine[]>(() => {
    if (mixte) return mixedPayments.filter((p) => p.montant > 0);
    if (singleMode === "ESPECES") {
      return [{ mode: "ESPECES", montant: total, montantRecu: montantRecu ?? total }];
    }
    if (singleMode === "MOBILE_MONEY") {
      return [{ mode: "MOBILE_MONEY", montant: total, reference: reference || undefined }];
    }
    return [{ mode: "CREDIT", montant: total }];
  }, [mixte, mixedPayments, singleMode, total, montantRecu, reference]);

  const requiresClient = effectivePayments.some((p) => p.mode === "CREDIT");

  const resetCart = useCallback(() => {
    setCart([]);
    setRemise(0);
    setTypeRemise("MONTANT");
    setMixte(false);
    setSingleMode("ESPECES");
    setMontantRecu(null);
    setReference("");
    setMixedPayments([]);
    setClientId(null);
    setError(null);
  }, []);

  const validate = useCallback((): string | null => {
    if (cart.length === 0) return "Le panier est vide.";
    const sum = Math.round(effectivePayments.reduce((s, p) => s + p.montant, 0));
    if (sum !== Math.round(total)) {
      return `Le total des paiements (${formatFcfa(sum)}) ne correspond pas au total de la vente (${formatFcfa(total)}).`;
    }
    if (requiresClient && !clientId) return "Un client est requis pour un paiement à crédit.";
    if (!mixte && singleMode === "ESPECES" && montantRecu != null && montantRecu < total) {
      return "Le montant reçu est inférieur au total à payer.";
    }
    if (mixte && mixedPayments.length === 0) return "Ajoutez au moins un mode de paiement.";
    return null;
  }, [cart.length, effectivePayments, total, requiresClient, clientId, mixte, singleMode, montantRecu, mixedPayments.length]);

  // --- Validation de la vente ---------------------------------------------
  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    const saleId = createId();
    const deviceId = deviceIdRef.current || getOrCreateDeviceId();
    const nowIso = new Date().toISOString();
    const clientNom = clientId ? clients.find((c) => c.id === clientId)?.nom ?? null : null;

    const itemsPayload = cart.map((l) => ({
      productId: l.productId,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      prixAchatUnitaire: l.prixAchatUnitaire,
      sousTotal: Math.round(l.prixUnitaire * l.quantite),
    }));

    const paymentsPayload = effectivePayments.map((p) => ({
      mode: p.mode,
      montant: Math.round(p.montant),
      montantRecu: p.mode === "ESPECES" && p.montantRecu != null ? Math.round(p.montantRecu) : undefined,
      monnaieRendue:
        p.mode === "ESPECES" && p.montantRecu != null ? Math.max(0, Math.round(p.montantRecu - p.montant)) : undefined,
      reference: p.reference ?? undefined,
    }));

    let serverSale: { numero: string } | null = null;
    let usedOnlinePath = false;

    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const res = await fetch("/api/vendre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: saleId,
            clientId,
            remise: remiseAmount,
            typeRemise,
            // `prixUnitaire` toujours envoyé (égal au catalogue si non négocié) : le serveur ne
            // fait la distinction qu'à la comparaison avec son propre prix catalogue, jamais sur
            // la présence ou l'absence du champ — évite un chemin « avec prix » / « sans prix »
            // distinct à maintenir des deux côtés.
            items: cart.map((l) => ({ productId: l.productId, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
            payments: paymentsPayload,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erreur serveur");
        }
        const data = await res.json();
        serverSale = data.sale;
        usedOnlinePath = true;
      } catch (e) {
        // Repli hors-ligne ci-dessous (réseau instable malgré navigator.onLine, timeout, etc.).
        console.warn("[vendre] création en ligne échouée, repli hors-ligne", e);
      }
    }

    const offlineSaleRecord: OfflineSale = {
      id: saleId,
      storeId,
      numero: serverSale?.numero ?? "HORS-LIGNE",
      dateHeure: nowIso,
      userId,
      deviceId,
      clientId: clientId ?? null,
      sousTotal,
      remise: remiseAmount,
      typeRemise,
      total,
      statut: "VALIDEE",
      items: itemsPayload,
      payments: paymentsPayload,
      synced: usedOnlinePath,
    };
    await offlineDb.sales.add(offlineSaleRecord);

    if (!usedOnlinePath) {
      await enqueueMutation({
        entite: "sale",
        entiteId: saleId,
        action: "create",
        payload: {
          id: saleId,
          clientId,
          dateHeure: nowIso,
          remise: remiseAmount,
          typeRemise,
          userId,
          // Pas `deviceId` ici : `getOrCreateDeviceId()` fabrique une clé purement locale
          // (`dev_xxx`), qui ne correspond à aucune ligne réelle de `devices` côté serveur — elle
          // ne peut donc jamais satisfaire la clé étrangère `sales.device_id → devices.id`. La
          // laisser passer forçait `/api/vendre/sync` à interroger `devices` pour rien à chaque
          // synchro (recherche vouée à échouer) avant de retomber sur l'appareil de la session.
          // `null` obtient exactement le même résultat côté serveur, sans ce détour : la vente est
          // attribuée à l'appareil de la session qui effectue réellement la synchro.
          deviceId: null,
          items: itemsPayload,
          payments: paymentsPayload,
        },
        userId,
        // Champ toujours requis par le schéma de /api/vendre/sync mais non lu pour l'attribution
        // (elle se fait via `payload.deviceId`, ci-dessus) : cette clé locale suffit à satisfaire
        // la validation sans prétendre désigner un appareil réel.
        deviceId,
        // La vente connaît déjà sa boutique (elle vient d'être ajoutée à `offlineSaleRecord` avec
        // ce même `storeId`) : sur un appareil que plusieurs vendeurs se partagent, c'est ce qui
        // empêche le moteur de synchro de la rejouer plus tard sous la session d'une autre boutique.
        storeId,
      });
      // Tentative immédiate (utile si navigator.onLine mentait, ou si la connexion vient de revenir) ;
      // sinon la vente reste en file et sera rejouée par le listener "online"/l'intervalle du moteur de synchro.
      void runSync(storeId).then(async () => {
        const stillQueued = await offlineDb.syncQueue.where("entiteId").equals(saleId).count();
        if (stillQueued === 0) {
          await offlineDb.sales.update(saleId, { synced: true });
        }
        // Uniquement les ventes de cette boutique : la file peut aussi contenir, sur un appareil
        // partagé, des entrées laissées par un autre compte — elles ne concernent pas ce vendeur.
        const enAttente = await offlineDb.syncQueue
          .where("entite")
          .equals("sale")
          .and((entry) => appartientALaBoutique(entry, storeId))
          .count();
        setPendingSyncCount(enAttente ?? 0);
      });
    }

    // Décompte optimiste du stock affiché dans la grille (le serveur reste la source de vérité).
    setProducts((prev) =>
      prev.map((p) => {
        const line = cart.find((l) => l.productId === p.id);
        if (!line) return p;
        return { ...p, quantiteStock: String(Math.max(0, Number(p.quantiteStock) - line.quantite)) };
      })
    );

    setReceipt({
      numero: serverSale?.numero ?? "En attente (hors-ligne)",
      dateHeure: nowIso,
      storeName,
      clientNom,
      items: cart.map((l) => ({
        nom: l.nom,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        sousTotal: Math.round(l.prixUnitaire * l.quantite),
      })),
      sousTotal,
      remise: remiseAmount,
      typeRemise,
      total,
      payments: paymentsPayload.map((p) => ({ mode: p.mode, montant: p.montant, montantRecu: p.montantRecu ?? null })),
      pending: !usedOnlinePath,
    });
    setCartDialogOpen(false);
    resetCart();
    setSubmitting(false);
    toast.success(usedOnlinePath ? "Vente enregistrée." : "Vente enregistrée hors-ligne — en attente de synchronisation.");
  }, [
    validate,
    clientId,
    clients,
    cart,
    effectivePayments,
    remiseAmount,
    typeRemise,
    sousTotal,
    total,
    storeId,
    userId,
    storeName,
    resetCart,
  ]);

  const cartPanelProps = {
    lines: cart,
    onIncrement: increment,
    onDecrement: decrement,
    onRemove: removeLine,
    onPriceChange: updatePrice,
    canModifierPrix,
    remise,
    typeRemise,
    onRemiseChange: (v: number) => setRemise(v),
    onTypeRemiseChange: (v: DiscountType) => setTypeRemise(v),
    sousTotal,
    remiseAmount,
    total,
    mixte,
    onToggleMixte: () => setMixte((v) => !v),
    singleMode,
    onSingleModeChange: setSingleMode,
    montantRecu,
    onMontantRecuChange: setMontantRecu,
    reference,
    onReferenceChange: setReference,
    mixedPayments,
    onMixedPaymentsChange: setMixedPayments,
    clients,
    clientId,
    onClientChange: setClientId,
    // Un client créé au comptoir rejoint la liste sans recharger le catalogue : la vente en
    // cours ne doit pas être interrompue.
    onClientCreated: (client: VendreClient) =>
      setClients((prev) =>
        prev.some((c) => c.id === client.id)
          ? prev
          : [...prev, client].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
      ),
    onSubmit: handleSubmit,
    submitting,
    error,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:h-[calc(100dvh-6.5rem)] lg:flex-row">
      {!online && (
        <div className="flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs font-medium text-warning lg:hidden">
          <WifiOff size={14} /> Mode hors-ligne — les ventes seront synchronisées automatiquement au retour du réseau.
        </div>
      )}

      <div className="min-h-[420px] flex-1 lg:min-h-0">
        <ProductGrid
          products={products}
          categories={categories}
          loading={loadingProducts}
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          barcode={barcode}
          onBarcodeChange={setBarcode}
          onBarcodeSubmit={() => void addByBarcode(barcode)}
          onScanClick={() => setScannerOpen(true)}
          onAddProduct={addProduct}
        />
      </div>

      {/* Panier — colonne fixe visible sur grand écran */}
      <div className="hidden lg:block lg:w-[380px] lg:shrink-0">
        <div className="flex h-full flex-col rounded-xl border border-border bg-card p-3">
          {!online && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs font-medium text-warning">
              <WifiOff size={14} /> Hors-ligne{pendingSyncCount > 0 ? ` — ${pendingSyncCount} vente(s) en attente` : ""}
            </div>
          )}
          <CartPanel {...cartPanelProps} />
        </div>
      </div>

      {/* Barre panier mobile */}
      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => setCartDialogOpen(true)}
          className="fixed inset-x-3 bottom-20 z-30 flex h-14 items-center justify-between rounded-xl bg-primary px-4 text-primary-foreground shadow-lg lg:hidden"
        >
          <span className="font-medium">{cart.length} article{cart.length > 1 ? "s" : ""}</span>
          <span className="font-bold">{formatFcfa(total)} · Voir le panier</span>
        </button>
      )}
      <Dialog open={cartDialogOpen} onClose={() => setCartDialogOpen(false)} title="Panier" className="lg:hidden">
        <CartPanel {...cartPanelProps} />
      </Dialog>

      <BarcodeScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          void addByBarcode(code);
        }}
      />

      <Dialog open={!!receipt} onClose={() => setReceipt(null)} title="Vente validée">
        {receipt && <ReceiptView receipt={receipt} onClose={() => setReceipt(null)} />}
      </Dialog>
    </div>
  );
}
