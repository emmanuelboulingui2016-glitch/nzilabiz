// NzilaBiz — schéma de données Drizzle ORM
// Traduit de §15 "Modèle de données" du cahier des charges (sahilleypromptconstruction.md).
//
// Écart documenté (voir README « Écarts vs cahier des charges ») : le cahier des charges
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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["ESSAI", "ESSENTIEL", "PREMIUM", "ENTREPRISE"]);
export const approvalActionTypeEnum = pgEnum("approval_action_type", ["ANNULATION_VENTE", "REMISE_SEUIL", "MODIFICATION_PRIX"]);
export const approvalStatusEnum = pgEnum("approval_status", ["EN_ATTENTE", "APPROUVEE", "REJETEE"]);
export const documentTypeEnum = pgEnum("document_type", ["FACTURE", "PROFORMA", "REMBOURSEMENT"]);
export const documentStatusEnum = pgEnum("document_status", ["BROUILLON", "EMISE", "CONVERTIE", "ANNULEE"]);
export const supportStatusEnum = pgEnum("support_status", ["OUVERT", "EN_COURS", "RESOLU", "FERME"]);
export const emailVerificationTypeEnum = pgEnum("email_verification_type", ["INSCRIPTION", "CHANGEMENT_EMAIL"]);
export const permissionOverrideActionEnum = pgEnum("permission_override_action", ["ACCORDEE", "RETIREE"]);
export const paymentRequestStatusEnum = pgEnum("payment_request_status", ["EN_ATTENTE", "PAYEE", "EXPIREE", "ANNULEE"]);
export const paymentConfirmationSourceEnum = pgEnum("payment_confirmation_source", ["MANUELLE", "AGREGATEUR"]);

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
  // Taux de change manuel saisi par le commerçant (1 unité de `devise` = X FCFA). Sert à
  // afficher un ordre de grandeur quand la boutique travaille dans une autre devise que le FCFA.
  tauxChangeManuel: numeric("taux_change_manuel", { precision: 14, scale: 4 }),
  langueDefaut: text("langue_defaut").notNull().default("fr"),
  plan: subscriptionPlanEnum("plan").notNull().default("ESSAI"),
  essaiExpireLe: timestamp("essai_expire_le"),
  // Boutique entrée par le lien testeur : accès complet et gratuit jusqu'à la fin de la période
  // de test. Le marqueur sert à les distinguer des vrais clients dans l'administration, et à
  // savoir qui prévenir quand le programme se termine.
  programmeTest: boolean("programme_test").notNull().default(false),
  abonnementExpireLe: timestamp("abonnement_expire_le"),
  // Prix Entreprise négocié boutique par boutique : la formule n'affiche plus de prix public, le
  // propriétaire de la plateforme fixe un montant après négociation avec le commerçant, depuis son
  // panneau d'administration. Les quatre colonnes vivent ensemble et sont toutes nullables :
  // « aucune négociation en cours » est l'état par défaut et ne doit rien changer à l'affichage
  // existant (repli sur `TARIFS_DEFAUT.ENTREPRISE`, voir `src/lib/tarifs.ts`, tant qu'aucun montant
  // n'est fixé ici). `tarifNegocieCycle` est du texte et non l'un des cycles en enum : même choix
  // que `plan_tarifs.cycle` plus bas, pour la même raison — validé à l'écriture contre `Cycle`
  // (src/lib/tarifs.ts), pas figé par une contrainte SQL.
  tarifNegocieMontant: money("tarif_negocie_montant"),
  tarifNegocieCycle: text("tarif_negocie_cycle"),
  tarifNegocieFixeLe: timestamp("tarif_negocie_fixe_le"),
  tarifNegocieFixeParId: text("tarif_negocie_fixe_par_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  // Formule Entreprise : une boutique peut être rattachée à une « maison mère ». Le contrat
  // d'abonnement est alors porté par la maison mère seule — c'est elle qu'on facture, et son
  // échéance gouverne l'accès de toutes ses boutiques (voir `src/lib/abonnement.ts`).
  //
  // `set null` et non `cascade` : supprimer la maison mère ne doit jamais effacer les ventes,
  // le stock et les clients des boutiques rattachées. Elles redeviennent indépendantes, avec
  // leur propre plan — quitte à ce qu'un administrateur doive trancher ensuite.
  maisonMereId: text("maison_mere_id").references((): AnyPgColumn => stores.id, { onDelete: "set null" }),
  noteBasFacture: text("note_bas_facture"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
}, (t) => ({
  maisonMereIdx: index("stores_maison_mere_idx").on(t.maisonMereId),
}));

// ---------------------------------------------------------------------------
// Utilisateurs & appareils
// ---------------------------------------------------------------------------

/**
 * Comptes de l'application.
 *
 * Un compte s'identifie par une adresse e-mail **ou** par un numéro de téléphone, jamais par rien.
 * C'est une règle métier : le patron ouvre la boutique avec son adresse, ses gérants et vendeurs
 * se connectent avec leur numéro. La plupart des vendeurs d'Afrique centrale n'ont pas d'adresse
 * e-mail ; leur en inventer une pour satisfaire un schéma revenait à leur donner un identifiant
 * qu'ils ne retenaient pas.
 *
 * Les deux colonnes sont donc nullables et uniques. PostgreSQL autorise plusieurs NULL dans un
 * index unique : c'est exactement ce qu'il faut pour que dix vendeurs sans e-mail coexistent.
 *
 * La contrainte « au moins l'un des deux » est tenue par le code, pas par une contrainte CHECK :
 * elle devrait sinon être levée puis reposée à chaque migration touchant la table, et une
 * migration qui échoue à mi-chemin sur une base de production coûte plus cher que le garde-fou
 * n'apporte. Les deux seuls endroits qui créent une ligne — la création par le patron et
 * l'acceptation d'une invitation — la vérifient.
 *
 * Les numéros sont stockés sous leur forme normalisée : chiffres seuls, indicatif compris. Voir
 * `src/lib/telephone.ts` pour la raison — c'est le même piège que la casse des e-mails.
 */
export const users = pgTable("users", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  email: text("email").unique(),
  telephone: text("telephone").unique(),
  // Vérification d'adresse à l'inscription (jeton dans `emailVerificationTokens` ci-dessous) :
  // date à laquelle l'adresse `email` courante a été confirmée, `null` tant qu'elle ne l'est pas.
  //
  // Décision assumée : cette date ne conditionne JAMAIS la connexion, contrairement à
  // `desactiveLe`. L'envoi d'e-mail n'est pas encore câblé en production (aucun identifiant SMTP) —
  // si l'accès en dépendait, plus personne ne pourrait s'inscrire. C'est un état affiché quelque
  // part dans l'interface, pas un verrou d'accès.
  emailVerifieLe: timestamp("email_verifie_le"),
  // Changement d'adresse e-mail de la boutique : la nouvelle adresse saisie par le patron est
  // stockée ici, à part de `email`, et ne remplace `email` qu'une fois son jeton de vérification
  // (même table `emailVerificationTokens`, type CHANGEMENT_EMAIL) consommé. Sans cette séparation,
  // une simple faute de frappe sur la nouvelle adresse fermerait l'accès au compte — c'est la seule
  // adresse de la boutique, les employés se connectent par numéro (voir `src/lib/telephone.ts`), il
  // n'y a personne d'autre pour la corriger. Pas de contrainte unique ici, volontairement : deux
  // comptes peuvent avoir la même adresse « en attente » en même temps sans se gêner, seule la
  // bascule finale vers `email` (unique, elle) tranche laquelle aboutit.
  nouvelEmail: text("nouvel_email"),
  motDePasseHash: text("mot_de_passe_hash"),
  role: roleEnum("role").notNull().default("VENDEUR"),
  photoUrl: text("photo_url"),
  googleId: text("google_id"),
  derniereConnexion: timestamp("derniere_connexion"),
  // Suppression de compte d'un employé : on anonymise et on désactive au lieu de supprimer la
  // ligne — ses ventes passées doivent rester dans l'historique et les rapports de la boutique.
  // Un compte désactivé ne peut plus se connecter (vérifié dans /api/auth/login).
  //
  // Étendu ici pour la suppression déclenchée par le patron sur le compte d'un employé — distincte
  // de l'auto-suppression ci-dessus (route /api/parametres/compte), qui reste immédiate et
  // anonymisante. `desactiveLe` seul suffisait à couper la connexion ; il manquait la traçabilité et
  // la fenêtre de restauration de 48h. On étend donc le même marqueur plutôt que d'en ajouter un
  // second concurrent — deux façons de fermer un compte dans le même schéma auraient fini par
  // diverger.
  desactiveLe: timestamp("desactive_le"),
  /** Qui a désactivé ce compte : le patron pour une suppression d'employé, l'employé lui-même pour une auto-suppression. */
  desactiveParId: text("desactive_par_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  // Jusqu'à quand la suppression est réversible. Renseigné uniquement pour une suppression
  // d'employé décidée par le patron (fenêtre de 48h) ; laissé `null` pour un compte actif comme
  // pour une auto-suppression anonymisée, qui n'est jamais restaurable. Cette colonne fait donc
  // aussi office de marqueur du type de désactivation, sans ajouter de colonne dédiée à cela.
  restaurationExpireLe: timestamp("restauration_expire_le"),
  restaureLe: timestamp("restaure_le"),
  restaureParId: text("restaure_par_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

/**
 * Accès d'un utilisateur à une boutique **autre que la sienne** — le socle du réseau Entreprise.
 *
 * `users.store_id` reste la boutique d'origine du compte, celle où il a été créé et où vivent ses
 * ventes. Cette table n'y touche pas : elle ajoute des accès, elle n'en déplace aucun. Un compte
 * sans aucune ligne ici se comporte exactement comme avant.
 *
 * Le rôle est porté par le rattachement, pas par le compte : un patron reste patron dans sa
 * boutique d'origine même s'il n'est que gérant dans une autre. C'est ce rôle-là qui est inscrit
 * dans la session au moment de basculer.
 */
export const storeMemberships = pgTable("store_memberships", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("PATRON"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
}, (t) => ({
  userStoreUnique: uniqueIndex("store_memberships_user_store_unique").on(t.userId, t.storeId),
  userIdx: index("store_memberships_user_idx").on(t.userId),
  storeIdx: index("store_memberships_store_idx").on(t.storeId),
}));

/**
 * Dérogation individuelle à la matrice de rôles (`src/lib/auth/rbac.ts`) : le patron accorde à un
 * employé un droit que son rôle ne donne pas (ACCORDEE), ou lui retire un droit que son rôle donne
 * (RETIREE) — les deux sens sont modélisés, pas seulement l'ajout. La résolution finale d'une
 * permission pour un utilisateur est donc : matrice de son rôle, puis dérogation active la plus
 * récente sur ce couple (utilisateur, permission) si elle existe, côté application.
 *
 * `permission` est du texte libre et non un pgEnum Postgres : le vocabulaire qui fait autorité est
 * le type `Permission` de rbac.ts (une trentaine de valeurs aujourd'hui, appelé à s'enrichir), validé
 * par Zod à l'écriture. Un pgEnum aurait fallu l'élargir — donc une migration de plus — à chaque
 * nouvelle permission ajoutée dans rbac.ts, pour une contrainte que l'application vérifie déjà à
 * l'entrée. Même choix, pour la même raison, que `plan_tarifs.plan`/`.cycle` plus bas.
 *
 * Traçable et jamais réécrite : une dérogation retirée n'est pas supprimée ni mise à jour en place,
 * elle est marquée `revoqueLe`/`revoqueParId` et une nouvelle ligne est insérée si besoin — c'est un
 * droit d'accès, son historique doit survivre à son propre retrait.
 */
export const employeePermissionOverrides = pgTable("employee_permission_overrides", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(),
  action: permissionOverrideActionEnum("action").notNull(),
  accordeParId: text("accorde_par_id").notNull().references(() => users.id),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
  revoqueLe: timestamp("revoque_le"),
  revoqueParId: text("revoque_par_id").references(() => users.id),
}, (t) => ({
  userIdx: index("employee_permission_overrides_user_idx").on(t.userId),
  storeIdx: index("employee_permission_overrides_store_idx").on(t.storeId),
}));

// Un login insère une nouvelle ligne ici (voir /api/auth/login et /api/auth/register, qui ne
// cherchent jamais un appareil existant avant d'insérer) : la table sert donc déjà de journal de
// connexion — une ligne par connexion, pas seulement un registre d'appareils actifs. C'est ce qui
// permet au patron de voir qui s'est connecté, quand et depuis quel appareil (`getDevices`, filtré
// par storeId, voir src/components/synchronisation/queries.ts) sans table de journal supplémentaire
// — en ajouter une aurait doublonné celle-ci pour la même information.
export const devices = pgTable("devices", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  userAgent: text("user_agent"),
  derniereActivite: timestamp("derniere_activite").notNull().defaultNow(),
  revoque: boolean("revoque").notNull().default(false),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
}, (t) => ({
  // Requête du patron (module Synchronisation) : connexions d'une boutique, plus récentes d'abord.
  storeActiviteIdx: index("devices_store_derniere_activite_idx").on(t.storeId, t.derniereActivite),
  userIdx: index("devices_user_idx").on(t.userId),
}));

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
  // Fiche clientèle (module Clients) — informations de contact et de suivi pour les boutiques
  // qui ont une clientèle fidèle et récurrente. Le segment de fidélité (fidèle/récurrent/…)
  // n'est pas stocké : il est recalculé depuis l'historique des ventes à chaque lecture.
  email: text("email"),
  adresse: text("adresse"),
  notes: text("notes"),
  // Archivage plutôt que suppression : un client est référencé par ses ventes passées
  // (sales.client_id), le supprimer casserait l'historique.
  archive: boolean("archive").notNull().default(false),
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
  // Prix catalogue (`products.prixVente`) au moment de la vente, capturé à côté du prix réellement
  // pratiqué (`prixUnitaire`), que le vendeur peut désormais modifier directement à la caisse. Sans
  // cette référence figée, impossible de distinguer après coup un rabais légitime d'un prix
  // sous-déclaré pour empocher la différence — exactement la faille corrigée cette nuit sur
  // /api/vendre/sync (prix client borné et journalisé en texte dans `syncLogs`, mais jamais conservé
  // structurellement face à sa référence catalogue). Nullable et sans défaut : les lignes de vente
  // déjà enregistrées n'ont pas cette notion et ne doivent pas se voir attribuer une valeur inventée.
  prixCatalogueUnitaire: money("prix_catalogue_unitaire"),
  // Prix d'achat figé au moment de la vente (§13 : la marge brute doit être calculée sur ce prix,
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

// ---------------------------------------------------------------------------
// Tarifs des formules
// ---------------------------------------------------------------------------

/**
 * Grille tarifaire, modifiable depuis l'administration.
 *
 * Les montants vivaient en dur dans deux composants — la page tarifs publique et l'écran
 * Abonnement — qui pouvaient donc afficher des prix différents, et changer un prix demandait un
 * déploiement. Ils sont désormais lus en base, à un seul endroit.
 *
 * `plan` et `cycle` sont du texte et non des énumérations : une grille tarifaire doit pouvoir
 * accueillir une offre ponctuelle sans migration de schéma, et le tarif « à partir de » d'Entreprise
 * n'a pas le même statut que les autres. Les valeurs acceptées sont validées à l'écriture.
 */
export const planTarifs = pgTable("plan_tarifs", {
  id: id(),
  plan: text("plan").notNull(),
  cycle: text("cycle").notNull(),
  montant: money("montant").notNull(),
  misAJourLe: timestamp("mis_a_jour_le").notNull().defaultNow(),
}, (t) => ({
  planCycleUnique: uniqueIndex("plan_tarifs_plan_cycle_unique").on(t.plan, t.cycle),
}));

// ---------------------------------------------------------------------------
// Plateforme : réglages éditables, support, invitations
// ---------------------------------------------------------------------------

// Réglages de la plateforme, éditables depuis l'administration — une seule ligne.
// Ils alimentent le site public (coordonnées, mentions légales) et l'aide dans l'application :
// changer le numéro de support ne demande donc plus de toucher au code ni de redéployer.
export const platformSettings = pgTable("platform_settings", {
  id: id(),
  nomApplication: text("nom_application").notNull().default("NzilaBiz"),
  slogan: text("slogan").notNull().default("Gérez votre boutique, simplement, au quotidien"),

  supportTelephone: text("support_telephone"),
  supportWhatsapp: text("support_whatsapp"),
  supportEmail: text("support_email"),
  supportHoraires: text("support_horaires"),

  // Message affiché en bandeau dans l'application (maintenance, nouveauté, rappel d'échéance).
  annonce: text("annonce"),
  annonceActive: boolean("annonce_active").notNull().default(false),

  // Mentions légales — remplacent les « [à compléter] » des pages publiques.
  editeurRaisonSociale: text("editeur_raison_sociale"),
  editeurFormeJuridique: text("editeur_forme_juridique"),
  editeurAdresse: text("editeur_adresse"),
  editeurImmatriculation: text("editeur_immatriculation"),
  editeurDirecteurPublication: text("editeur_directeur_publication"),
  hebergeurNom: text("hebergeur_nom"),
  hebergeurAdresse: text("hebergeur_adresse"),
  hebergeurPays: text("hebergeur_pays"),
  droitApplicable: text("droit_applicable"),
  juridictionCompetente: text("juridiction_competente"),
  autoriteProtectionDonnees: text("autorite_protection_donnees"),

  // Lien testeur : une seule adresse partagée à tous les testeurs de la période d'essai. Le code
  // vit ici plutôt qu'en variable d'environnement pour être révocable et prolongeable depuis
  // l'administration, sans redéploiement.
  testLienCode: text("test_lien_code"),
  testLienActif: boolean("test_lien_actif").notNull().default(false),
  testLienExpireLe: timestamp("test_lien_expire_le"),

  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),

  misAJourLe: timestamp("mis_a_jour_le").notNull().defaultNow(),
});

// Demandes d'assistance envoyées depuis l'application par les commerçants.
export const supportTickets = pgTable("support_tickets", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  // Recopiés à la création : le ticket doit rester lisible même si le compte est supprimé.
  //
  // Deux colonnes de contact, l'une ou l'autre selon la façon dont l'auteur se connecte. Un
  // vendeur qui n'a que son numéro doit pouvoir écrire au support, et le support doit pouvoir lui
  // répondre : ranger un numéro dans une colonne nommée « e-mail » aurait marché six mois, puis
  // trompé la première personne qui aurait tenté un envoi automatique.
  auteurNom: text("auteur_nom").notNull(),
  auteurEmail: text("auteur_email"),
  auteurTelephone: text("auteur_telephone"),
  sujet: text("sujet").notNull(),
  message: text("message").notNull(),
  statut: supportStatusEnum("statut").notNull().default("OUVERT"),
  reponse: text("reponse"),
  reponduParEmail: text("repondu_par_email"),
  reponduLe: timestamp("repondu_le"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
});

// Invitation d'un employé : le patron génère un lien (affiché en QR code), l'employé le scanne et
// crée son propre mot de passe. Remplace le mot de passe temporaire dicté de vive voix.
export const invitations = pgTable("invitations", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  role: roleEnum("role").notNull().default("VENDEUR"),
  nomPrevu: text("nom_prevu"),
  // `emailPrevu` appartient à l'époque où les employés se connectaient par adresse. Conservé pour
  // les invitations déjà émises ; les nouvelles réservent un numéro.
  emailPrevu: text("email_prevu"),
  telephonePrevu: text("telephone_prevu"),
  creeParId: text("cree_par_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expireLe: timestamp("expire_le").notNull(),
  utiliseLe: timestamp("utilise_le"),
  utiliseParId: text("utilise_par_id").references((): any => users.id, { onDelete: "set null" }),
  revoqueLe: timestamp("revoque_le"),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
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

// Compteurs de limitation de débit (connexion, inscription, support…).
//
// En base et non en mémoire : sur un hébergement sans serveur, chaque requête peut atterrir sur
// une instance différente, chacune avec sa propre mémoire. Un compteur local laisserait donc
// passer autant de tentatives qu'il y a d'instances. La table est partagée, elle ne ment pas.
//
// Pas de clé étrangère ni d'identifiant métier : la clé est composée par l'appelant
// (« login:ip:41.x.x.x », « support:<user>:<ip> ») et sert directement de clé primaire.
export const rateLimits = pgTable("rate_limits", {
  cle: text("cle").primaryKey(),
  fenetreDebut: timestamp("fenetre_debut", { withTimezone: true }).notNull().defaultNow(),
  compteur: integer("compteur").notNull().default(0),
  /** Renseigné quand la limite est franchie : tout est refusé jusqu'à cette date. */
  bloqueJusqua: timestamp("bloque_jusqua", { withTimezone: true }),
});

// Jetons de réinitialisation de mot de passe, envoyés par e-mail.
//
// C'est la seule empreinte du jeton qui est stockée, jamais le jeton lui-même — exactement comme
// pour un mot de passe. Quelqu'un qui lirait cette table ne pourrait pas en déduire un lien
// valide. SHA-256 suffit ici, là où un mot de passe exige bcrypt : le jeton fait 32 octets tirés
// au hasard, il n'y a rien à deviner par force brute.
//
// Usage unique et durée courte : un lien de réinitialisation qui traîne dans une boîte mail est
// une clé de la boutique. Il devient inerte dès qu'il a servi, et au bout d'une heure de toute
// façon.
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jetonHash: text("jeton_hash").notNull().unique(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    utiliseLe: timestamp("utilise_le", { withTimezone: true }),
    /** Trace de la demande : permet de repérer une campagne d'envois depuis une même origine. */
    demandeIp: text("demande_ip"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)]
);

// Jetons de vérification d'adresse e-mail — même modèle que `passwordResetTokens` ci-dessus, et
// volontairement : hachés en SHA-256 (jamais le jeton en clair), à usage unique, expirants. Deux
// usages distingués par `type`, dans la même table plutôt que deux tables séparées parce que le
// cycle de vie du jeton est identique dans les deux cas — seule l'adresse à confirmer diffère :
//
//   - INSCRIPTION : confirme l'adresse `users.email` courante. Ne bloque jamais la connexion (voir
//     le commentaire sur `users.emailVerifieLe`) — l'envoi d'e-mail n'est pas encore câblé en
//     production, un verrou aurait fermé l'inscription à tout le monde.
//   - CHANGEMENT_EMAIL : confirme `users.nouvelEmail`, l'adresse en attente saisie par le patron.
//     Ce cas-là conditionne bien quelque chose : c'est sa confirmation qui fait basculer
//     `nouvelEmail` vers `email`, jamais la saisie seule — sinon une faute de frappe fermerait
//     l'accès au compte, qui est aussi le seul e-mail de la boutique.
//
// `email` recopie l'adresse visée par CE jeton précis, plutôt que de la relire sur `users` au
// moment de la vérification : si une nouvelle demande écrase `users.nouvelEmail` entre-temps, un
// lien plus ancien encore valide ne doit pas se retrouver à confirmer la mauvaise adresse.
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: emailVerificationTypeEnum("type").notNull(),
    email: text("email").notNull(),
    jetonHash: text("jeton_hash").notNull().unique(),
    expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
    utiliseLe: timestamp("utilise_le", { withTimezone: true }),
    demandeIp: text("demande_ip"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_verification_tokens_user_idx").on(t.userId)]
);

/**
 * Demande de paiement — formule Entreprise négociée (`stores.tarifNegocie*` ci-dessus) et, plus
 * largement, toute facturation manuelle émise depuis l'administration en attendant qu'un
 * agrégateur Mobile Money (PayDunya / CinetPay / Flutterwave — choix non arrêté) soit branché.
 *
 * Le circuit de confirmation est délibérément unique, qu'il soit actionné à la main aujourd'hui ou
 * par un rappel automatique demain : `confirmeeLe` / `confirmeeSource` / `confirmeeParId` sont
 * renseignés dans les deux cas, seule `confirmeeSource` distingue laquelle des deux voies a eu
 * lieu. Un second circuit dédié à l'agrégateur aurait fini par diverger du premier — deux façons de
 * dire « payé » pour une même ligne de facturation, c'est l'écart de caisse qui attend son heure.
 *
 * `agregateurFournisseur` est du texte libre (comme `permission` plus haut et `plan_tarifs.plan` /
 * `.cycle` plus bas) : le fournisseur n'est pas encore choisi, un pgEnum aurait figé une valeur
 * qu'on ne connaît pas encore et aurait exigé une migration le jour du choix.
 *
 * `agregateurReference` porte un index unique partiel, actif seulement quand elle est renseignée :
 * un agrégateur rejoue ses webhooks, la même référence de transaction ne doit jamais créditer deux
 * fois. C'est le piège classique de ce genre d'intégration — le prévoir maintenant coûte une
 * colonne et un index, le rattraper après coûte un incident de facturation.
 *
 * `montant` utilise le même helper `money()` (numeric 14,2) que `sales.total` et `plan_tarifs.montant`
 * — une seule convention de stockage de l'argent dans tout le schéma. Le FCFA n'a pas de sous-unité,
 * mais ce n'est pas une raison de stocker les montants différemment ici : deux conventions dans une
 * même base, c'est une erreur d'arrondi qui attend son heure. `devise` est recopiée depuis
 * `stores.devise` au moment de l'émission plutôt que relue depuis `stores` a posteriori — la devise
 * de la boutique pourrait changer, cette ligne de facturation ne doit pas changer de sens après coup.
 */
export const paymentRequests = pgTable("payment_requests", {
  id: id(),
  storeId: text("store_id").notNull().references(() => stores.id, { onDelete: "cascade" }),
  plan: subscriptionPlanEnum("plan").notNull(),
  cycle: text("cycle").notNull(),
  montant: money("montant").notNull(),
  devise: text("devise").notNull(),
  // Période couverte par ce paiement (ex. le mois, le trimestre ou l'année facturé).
  periodeDebut: timestamp("periode_debut").notNull(),
  periodeFin: timestamp("periode_fin").notNull(),
  statut: paymentRequestStatusEnum("statut").notNull().default("EN_ATTENTE"),
  emiseParId: text("emise_par_id").notNull().references(() => users.id),
  creeLe: timestamp("cree_le").notNull().defaultNow(),
  // Confirmation : manuelle aujourd'hui (le propriétaire clique depuis l'administration,
  // `confirmeeParId` porte son identité), automatique demain (rappel de l'agrégateur,
  // `confirmeeParId` reste `null` — personne n'a cliqué, `confirmeeSource` vaut AGREGATEUR).
  confirmeeLe: timestamp("confirmee_le"),
  confirmeeSource: paymentConfirmationSourceEnum("confirmee_source"),
  confirmeeParId: text("confirmee_par_id").references(() => users.id),
  // Couture agrégateur : vide tant qu'aucun n'est branché, prête à être renseignée le jour venu
  // sans nouvelle migration ni reprise de données.
  agregateurFournisseur: text("agregateur_fournisseur"),
  agregateurReference: text("agregateur_reference"),
  expireLe: timestamp("expire_le"),
  annuleeLe: timestamp("annulee_le"),
}, (t) => ({
  storeIdx: index("payment_requests_store_idx").on(t.storeId),
  statutIdx: index("payment_requests_statut_idx").on(t.statut),
  // Idempotence du rappel de l'agrégateur : partiel, actif seulement quand une référence existe —
  // deux demandes EN_ATTENTE n'ont sinon aucune référence à comparer.
  agregateurReferenceUnique: uniqueIndex("payment_requests_agregateur_reference_unique")
    .on(t.agregateurFournisseur, t.agregateurReference)
    .where(sql`${t.agregateurReference} is not null`),
}));

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
