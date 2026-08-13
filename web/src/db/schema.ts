// NzilaBiz — schéma de données Drizzle ORM
// Traduit de §15 "Modèle de données" du cahier des charges (sahilleypromptconstruction.md).
//
// 🔧 Écart documenté (voir README « Écarts vs cahier des charges ») : le cahier des charges
// recommandait Postgres via une couche ORM classique. Nous avions initialement écrit ce schéma
// avec Prisma, mais le téléchargement des binaires moteur de Prisma (binaries.prisma.sh) est
// bloqué par le pare-feu sortant de cet environnement de build (hors-liste blanche). Nous sommes
// donc passés à Drizzle ORM, qui est 100% TypeScript/npm (aucun binaire externe à télécharger) et
// reste compatible Postgres. Le modèle de données ci-dessous est fonctionnellement identique.

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  numeric,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["PATRON", "GERANT", "VENDEUR"]);
export const paymentModeEnum = pgEnum("payment_mode", ["ESPECES", "MOBILE_MONEY", "CREDIT"]);
export const saleStatusEnum = pgEnum("sale_status", ["VALIDEE", "ANNULEE"]);
export const discountTypeEnum = pgEnum("discount_type", ["MONTANT", "POURCENTAGE"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["VENTE", "ANNULATION", "RECEPTION", "AJUSTEMENT"]);
export const cashCountTypeEnum = pgEnum("cash_count_type", ["OUVERTURE", "FERMETURE"]);
export const expenseFrequencyEnum = pgEnum("expense_frequency", ["HEBDOMADAIRE", "MENSUELLE"]);
export const syncStatusEnum = pgEnum("sync_status", ["OK", "ECHEC", "EN_ATTENTE"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["ESSAI", "PREMIUM", "ENTREPRISE"]);
export const approvalActionTypeEnum = pgEnum("approval_action_type", ["ANNULATION_VENTE", "REMISE_SEUIL", "MODIFICATION_PRIX"]);
export const approvalStatusEnum = pgEnum("approval_status", ["EN_ATTENTE", "APPROUVEE", "REJETEE"]);
export const documentTypeEnum = pgEnum("document_type", ["FACTURE", "PROFORMA", "REMBOURSEMENT"]);
export const documentStatusEnum = pgEnum("document_status", ["BROUILLON", "EMISE", "CONVERTIE", "ANNULEE"]);

// ---------------------------------------------------------------------------
// Boutique / Tenant
// ---------------------------------------------------------------------------

export const stores = pgTable("stores", {
  id: id(),
  nom: text("nom").notNull(),
  logoUrl: text("logo_url"),
  telephone: text("telephone"),
  adresse: text("adresse"),
  ville: text("ville"),
  quartier: text("quartier"),
  pays: text("pays").notNull().default("Gabon"),
  indicatif: text("indicatif").notNull().default("+241"),
  typeCommerce: text("type_commerce"),
  devise: text("devise").notNull().default("XAF"),
  langueDefaut: text("langue_defaut").notNull().default("fr"),
  plan: subscriptionPlanEnum("plan").notNull().default("ESSAI"),
  essaiExpireLe: timestamp("essai_expire_le"),
  abonnementExpireLe: timestamp("abonnement_expire_le"),
  noteBasFacture: text("note_bas_facture"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Utilisateurs & appareils
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  email: text("email").notNull().unique(),
  motDePasseHash: text("mot_de_passe_hash"),
  role: roleEnum("role").notNull().default("VENDEUR"),
  photoUrl: text("photo_url"),
  googleId: text("google_id"),
  twoFactorActive: boolean("two_factor_active").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  derniereConnexion: timestamp("derniere_connexion"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  userAgent: text("user_agent"),
  derniereActivite: timestamp("derniere_activite").notNull().defaultNow(),
  revoque: boolean("revoque").notNull().default(false),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
}, (t) => ({
  storeNomUnique: uniqueIndex("categories_store_nom_unique").on(t.storeId, t.nom),
}));

export const products = pgTable("products", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  nom: text("nom").notNull(),
  photoUrl: text("photo_url"),
  categoryId: text("category_id").references(() => categories.id),
  codeBarres: text("code_barres"),
  datePeremption: timestamp("date_peremption"),
  prixAchat: money("prix_achat").notNull(),
  prixVente: money("prix_vente").notNull(),
  prixGros: money("prix_gros"),
  unite: text("unite").notNull().default("unité"),
  quantiteStock: numeric("quantite_stock", { precision: 14, scale: 2 }).notNull().default("0"),
  seuilAlerte: numeric("seuil_alerte", { precision: 14, scale: 2 }).notNull().default("5"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
  misAJourLe: timestamp("mis_a_jour_le").notNull().defaultNow(),
}, (t) => ({
  storeRefUnique: uniqueIndex("products_store_reference_unique").on(t.storeId, t.reference),
  storeBarcodeIdx: index("products_store_barcode_idx").on(t.storeId, t.codeBarres),
}));

// ---------------------------------------------------------------------------
// Créances (clients) — déclaré avant Sale pour la référence croisée
// ---------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  telephone: text("telephone"),
  limiteCredit: money("limite_credit"),
  echeanceJours: integer("echeance_jours"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Réceptions de stock (déclaré avant Sale/Expense pour les FK croisées)
// ---------------------------------------------------------------------------

export const stockReceipts = pgTable("stock_receipts", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  fournisseur: text("fournisseur"),
  montantTotal: money("montant_total").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  userId: text("user_id").notNull().references(() => users.id),
});

export const stockReceiptItems = pgTable("stock_receipt_items", {
  id: id(),
  stockReceiptId: text("stock_receipt_id").notNull().references(() => stockReceipts.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  quantite: numeric("quantite", { precision: 14, scale: 2 }).notNull(),
  prixAchat: money("prix_achat").notNull(),
});

// ---------------------------------------------------------------------------
// Ventes
// ---------------------------------------------------------------------------

export const sales = pgTable("sales", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  numero: text("numero").notNull(),
  dateHeure: timestamp("date_heure").notNull().defaultNow(),
  userId: text("user_id").notNull().references(() => users.id),
  deviceId: text("device_id").references(() => devices.id),
  clientId: text("client_id").references(() => clients.id),
  sousTotal: money("sous_total").notNull(),
  remise: money("remise").notNull().default("0"),
  typeRemise: discountTypeEnum("type_remise").notNull().default("MONTANT"),
  total: money("total").notNull(),
  statut: saleStatusEnum("statut").notNull().default("VALIDEE"),
  motifAnnulation: text("motif_annulation"),
  approuveParId: text("approuve_par_id").references((): any => users.id),
  annuleLe: timestamp("annule_le"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
}, (t) => ({
  storeNumeroUnique: uniqueIndex("sales_store_numero_unique").on(t.storeId, t.numero),
}));

export const saleItems = pgTable("sale_items", {
  id: id(),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  quantite: numeric("quantite", { precision: 14, scale: 2 }).notNull(),
  prixUnitaire: money("prix_unitaire").notNull(),
  // 🔧 Prix d'achat figé au moment de la vente (§13 : la marge brute doit être calculée sur ce prix,
  // pas sur le prix d'achat courant du produit qui peut changer après coup).
  prixAchatUnitaire: money("prix_achat_unitaire").notNull().default("0"),
  sousTotal: money("sous_total").notNull(),
});

export const payments = pgTable("payments", {
  id: id(),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  mode: paymentModeEnum("mode").notNull(),
  montant: money("montant").notNull(),
  montantRecu: money("montant_recu"),
  monnaieRendue: money("monnaie_rendue"),
  reference: text("reference"),
});

export const debtRepayments = pgTable("debt_repayments", {
  id: id(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  saleId: text("sale_id").references(() => sales.id),
  montant: money("montant").notNull(),
  mode: paymentModeEnum("mode").notNull().default("ESPECES"),
  date: timestamp("date").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Dépenses
// ---------------------------------------------------------------------------

export const expenses = pgTable("expenses", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  categorie: text("categorie").notNull(),
  description: text("description").notNull(),
  montant: money("montant").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  modeReglement: paymentModeEnum("mode_reglement").notNull().default("ESPECES"),
  recurrente: boolean("recurrente").notNull().default(false),
  frequence: expenseFrequencyEnum("frequence"),
  pieceJointeUrl: text("piece_jointe_url"),
  stockReceiptId: text("stock_receipt_id").references(() => stockReceipts.id),
});

// ---------------------------------------------------------------------------
// Mouvements de stock
// ---------------------------------------------------------------------------

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: stockMovementTypeEnum("type").notNull(),
  quantite: numeric("quantite", { precision: 14, scale: 2 }).notNull(),
  motif: text("motif"),
  userId: text("user_id").notNull().references(() => users.id),
  saleId: text("sale_id").references(() => sales.id),
  stockReceiptId: text("stock_receipt_id").references(() => stockReceipts.id),
  date: timestamp("date").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Caisse
// ---------------------------------------------------------------------------

export const cashCounts = pgTable("cash_counts", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  type: cashCountTypeEnum("type").notNull(),
  montantSaisi: money("montant_saisi").notNull(),
  montantTheorique: money("montant_theorique"),
  ecart: money("ecart"),
  date: timestamp("date").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Notifications & approbations
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  type: text("type").notNull(),
  message: text("message").notNull(),
  lue: boolean("lue").notNull().default(false),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: id(),
  storeId: text("store_id").notNull().unique().references(() => stores.id, { onDelete: "cascade" }),
  creanceRetardJours: integer("creance_retard_jours").notNull().default(30),
  grosseDepenseSeuil: money("grosse_depense_seuil").notNull().default("50000"),
  peremptionAlerteJours: integer("peremption_alerte_jours").notNull().default(30),
  alerteStockBas: boolean("alerte_stock_bas").notNull().default(true),
  alertePeremption: boolean("alerte_peremption").notNull().default(true),
  alerteCreanceRetard: boolean("alerte_creance_retard").notNull().default(true),
  alerteVenteRealisee: boolean("alerte_vente_realisee").notNull().default(false),
  alerteGrosseDepense: boolean("alerte_grosse_depense").notNull().default(true),
  remiseSeuilApprobation: money("remise_seuil_approbation").notNull().default("0"),
});

export const approvalRequests = pgTable("approval_requests", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  type: approvalActionTypeEnum("type").notNull(),
  refType: text("ref_type").notNull(),
  refId: text("ref_id").notNull(),
  motif: text("motif"),
  demandeParId: text("demande_par_id").notNull().references(() => users.id),
  statut: approvalStatusEnum("statut").notNull().default("EN_ATTENTE"),
  decideParId: text("decide_par_id").references(() => users.id),
  decideLe: timestamp("decide_le"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Documents — §12 (Factures, Proformas, Remboursements)
// ---------------------------------------------------------------------------

export const documents = pgTable("documents", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  numero: text("numero").notNull(),
  statut: documentStatusEnum("statut").notNull().default("EMISE"),
  saleId: text("sale_id").references(() => sales.id),
  clientId: text("client_id").references(() => clients.id),
  clientNomLibre: text("client_nom_libre"),
  // Pour une PROFORMA créée sans vente : lignes brouillon au format
  // [{ productId, nom, quantite, prixUnitaire, sousTotal }]
  itemsBrouillon: text("items_brouillon"),
  montantTotal: money("montant_total").notNull(),
  convertieEnVenteId: text("convertie_en_vente_id").references((): any => sales.id),
  userId: text("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull().defaultNow(),
}, (t) => ({
  storeNumeroUnique: uniqueIndex("documents_store_numero_unique").on(t.storeId, t.numero),
}));

// ---------------------------------------------------------------------------
// Synchronisation
// ---------------------------------------------------------------------------

export const syncLogs = pgTable("sync_logs", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  deviceId: text("device_id").references(() => devices.id),
  entite: text("entite").notNull(),
  entiteId: text("entite_id"),
  action: text("action").notNull(),
  statut: syncStatusEnum("statut").notNull().default("OK"),
  message: text("message"),
  horodatage: timestamp("horodatage").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations (pour l'API relationnelle db.query.*)
// ---------------------------------------------------------------------------

export const storesRelations = relations(stores, ({ many, one }) => ({
  users: many(users),
  devices: many(devices),
  products: many(products),
  categories: many(categories),
  sales: many(sales),
  clients: many(clients),
  expenses: many(expenses),
  stockReceipts: many(stockReceipts),
  cashCounts: many(cashCounts),
  notifications: many(notifications),
  syncLogs: many(syncLogs),
  notificationSettings: one(notificationSettings),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
  devices: many(devices),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  movements: many(stockMovements),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  store: one(stores, { fields: [sales.storeId], references: [stores.id] }),
  user: one(users, { fields: [sales.userId], references: [users.id] }),
  device: one(devices, { fields: [sales.deviceId], references: [devices.id] }),
  client: one(clients, { fields: [sales.clientId], references: [clients.id] }),
  items: many(saleItems),
  payments: many(payments),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  sale: one(sales, { fields: [payments.saleId], references: [sales.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  store: one(stores, { fields: [clients.storeId], references: [stores.id] }),
  sales: many(sales),
  debtRepayments: many(debtRepayments),
}));

export const stockReceiptsRelations = relations(stockReceipts, ({ one, many }) => ({
  store: one(stores, { fields: [stockReceipts.storeId], references: [stores.id] }),
  items: many(stockReceiptItems),
}));
