CREATE TYPE "public"."approval_action_type" AS ENUM('ANNULATION_VENTE', 'REMISE_SEUIL', 'MODIFICATION_PRIX');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('EN_ATTENTE', 'APPROUVEE', 'REJETEE');--> statement-breakpoint
CREATE TYPE "public"."cash_count_type" AS ENUM('OUVERTURE', 'FERMETURE');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('MONTANT', 'POURCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."expense_frequency" AS ENUM('HEBDOMADAIRE', 'MENSUELLE');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('ESPECES', 'MOBILE_MONEY', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('PATRON', 'GERANT', 'VENDEUR');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('VALIDEE', 'ANNULEE');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('VENTE', 'ANNULATION', 'RECEPTION', 'AJUSTEMENT');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('ESSAI', 'PREMIUM', 'ENTREPRISE');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('OK', 'ECHEC', 'EN_ATTENTE');--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"type" "approval_action_type" NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" text NOT NULL,
	"motif" text,
	"demande_par_id" text NOT NULL,
	"statut" "approval_status" DEFAULT 'EN_ATTENTE' NOT NULL,
	"decide_par_id" text,
	"decide_le" timestamp,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_counts" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" "cash_count_type" NOT NULL,
	"montant_saisi" numeric(14, 2) NOT NULL,
	"montant_theorique" numeric(14, 2),
	"ecart" numeric(14, 2),
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"nom" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"nom" text NOT NULL,
	"telephone" text,
	"limite_credit" numeric(14, 2),
	"echeance_jours" integer,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt_repayments" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"sale_id" text,
	"montant" numeric(14, 2) NOT NULL,
	"mode" "payment_mode" DEFAULT 'ESPECES' NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text NOT NULL,
	"nom" text NOT NULL,
	"user_agent" text,
	"derniere_activite" timestamp DEFAULT now() NOT NULL,
	"revoque" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text,
	"categorie" text NOT NULL,
	"description" text NOT NULL,
	"montant" numeric(14, 2) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"mode_reglement" "payment_mode" DEFAULT 'ESPECES' NOT NULL,
	"recurrente" boolean DEFAULT false NOT NULL,
	"frequence" "expense_frequency",
	"piece_jointe_url" text,
	"stock_receipt_id" text
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"creance_retard_jours" integer DEFAULT 30 NOT NULL,
	"grosse_depense_seuil" numeric(14, 2) DEFAULT '50000' NOT NULL,
	"peremption_alerte_jours" integer DEFAULT 30 NOT NULL,
	"alerte_stock_bas" boolean DEFAULT true NOT NULL,
	"alerte_peremption" boolean DEFAULT true NOT NULL,
	"alerte_creance_retard" boolean DEFAULT true NOT NULL,
	"alerte_vente_realisee" boolean DEFAULT false NOT NULL,
	"alerte_grosse_depense" boolean DEFAULT true NOT NULL,
	"remise_seuil_approbation" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "notification_settings_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"lue" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"montant" numeric(14, 2) NOT NULL,
	"montant_recu" numeric(14, 2),
	"monnaie_rendue" numeric(14, 2),
	"reference" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"reference" text NOT NULL,
	"nom" text NOT NULL,
	"photo_url" text,
	"category_id" text,
	"code_barres" text,
	"date_peremption" timestamp,
	"prix_achat" numeric(14, 2) NOT NULL,
	"prix_vente" numeric(14, 2) NOT NULL,
	"prix_gros" numeric(14, 2),
	"unite" text DEFAULT 'unité' NOT NULL,
	"quantite_stock" numeric(14, 2) DEFAULT '0' NOT NULL,
	"seuil_alerte" numeric(14, 2) DEFAULT '5' NOT NULL,
	"cree_le" timestamp DEFAULT now() NOT NULL,
	"mis_a_jour_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantite" numeric(14, 2) NOT NULL,
	"prix_unitaire" numeric(14, 2) NOT NULL,
	"sous_total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"numero" text NOT NULL,
	"date_heure" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text,
	"client_id" text,
	"sous_total" numeric(14, 2) NOT NULL,
	"remise" numeric(14, 2) DEFAULT '0' NOT NULL,
	"type_remise" "discount_type" DEFAULT 'MONTANT' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"statut" "sale_status" DEFAULT 'VALIDEE' NOT NULL,
	"motif_annulation" text,
	"approuve_par_id" text,
	"annule_le" timestamp,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantite" numeric(14, 2) NOT NULL,
	"motif" text,
	"user_id" text NOT NULL,
	"sale_id" text,
	"stock_receipt_id" text,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_receipt_items" (
	"id" text PRIMARY KEY NOT NULL,
	"stock_receipt_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantite" numeric(14, 2) NOT NULL,
	"prix_achat" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"fournisseur" text,
	"montant_total" numeric(14, 2) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"logo_url" text,
	"adresse" text,
	"ville" text,
	"quartier" text,
	"pays" text DEFAULT 'Gabon' NOT NULL,
	"indicatif" text DEFAULT '+241' NOT NULL,
	"type_commerce" text,
	"devise" text DEFAULT 'XAF' NOT NULL,
	"langue_defaut" text DEFAULT 'fr' NOT NULL,
	"plan" "subscription_plan" DEFAULT 'ESSAI' NOT NULL,
	"essai_expire_le" timestamp,
	"abonnement_expire_le" timestamp,
	"note_bas_facture" text,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text,
	"device_id" text,
	"entite" text NOT NULL,
	"entite_id" text,
	"action" text NOT NULL,
	"statut" "sync_status" DEFAULT 'OK' NOT NULL,
	"message" text,
	"horodatage" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"nom" text NOT NULL,
	"email" text NOT NULL,
	"mot_de_passe_hash" text,
	"role" "role" DEFAULT 'VENDEUR' NOT NULL,
	"photo_url" text,
	"google_id" text,
	"two_factor_active" boolean DEFAULT false NOT NULL,
	"two_factor_secret" text,
	"derniere_connexion" timestamp,
	"cree_le" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_demande_par_id_users_id_fk" FOREIGN KEY ("demande_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decide_par_id_users_id_fk" FOREIGN KEY ("decide_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_repayments" ADD CONSTRAINT "debt_repayments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_repayments" ADD CONSTRAINT "debt_repayments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_stock_receipt_id_stock_receipts_id_fk" FOREIGN KEY ("stock_receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_approuve_par_id_users_id_fk" FOREIGN KEY ("approuve_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_receipt_id_stock_receipts_id_fk" FOREIGN KEY ("stock_receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_stock_receipt_id_stock_receipts_id_fk" FOREIGN KEY ("stock_receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_store_nom_unique" ON "categories" USING btree ("store_id","nom");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_reference_unique" ON "products" USING btree ("store_id","reference");--> statement-breakpoint
CREATE INDEX "products_store_barcode_idx" ON "products" USING btree ("store_id","code_barres");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_store_numero_unique" ON "sales" USING btree ("store_id","numero");