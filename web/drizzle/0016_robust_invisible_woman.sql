CREATE TYPE "public"."email_verification_type" AS ENUM('INSCRIPTION', 'CHANGEMENT_EMAIL');--> statement-breakpoint
CREATE TYPE "public"."payment_confirmation_source" AS ENUM('MANUELLE', 'AGREGATEUR');--> statement-breakpoint
CREATE TYPE "public"."payment_request_status" AS ENUM('EN_ATTENTE', 'PAYEE', 'EXPIREE', 'ANNULEE');--> statement-breakpoint
CREATE TYPE "public"."permission_override_action" AS ENUM('ACCORDEE', 'RETIREE');--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "email_verification_type" NOT NULL,
	"email" text NOT NULL,
	"jeton_hash" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	"demande_ip" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_jeton_hash_unique" UNIQUE("jeton_hash")
);
--> statement-breakpoint
CREATE TABLE "employee_permission_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text NOT NULL,
	"permission" text NOT NULL,
	"action" "permission_override_action" NOT NULL,
	"accorde_par_id" text NOT NULL,
	"cree_le" timestamp DEFAULT now() NOT NULL,
	"revoque_le" timestamp,
	"revoque_par_id" text
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"plan" "subscription_plan" NOT NULL,
	"cycle" text NOT NULL,
	"montant" numeric(14, 2) NOT NULL,
	"devise" text NOT NULL,
	"periode_debut" timestamp NOT NULL,
	"periode_fin" timestamp NOT NULL,
	"statut" "payment_request_status" DEFAULT 'EN_ATTENTE' NOT NULL,
	"emise_par_id" text NOT NULL,
	"cree_le" timestamp DEFAULT now() NOT NULL,
	"confirmee_le" timestamp,
	"confirmee_source" "payment_confirmation_source",
	"confirmee_par_id" text,
	"agregateur_fournisseur" text,
	"agregateur_reference" text,
	"expire_le" timestamp,
	"annulee_le" timestamp
);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "prix_catalogue_unitaire" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tarif_negocie_montant" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tarif_negocie_cycle" text;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tarif_negocie_fixe_le" timestamp;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tarif_negocie_fixe_par_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verifie_le" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nouvel_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "desactive_par_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restauration_expire_le" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restaure_le" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restaure_par_id" text;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_permission_overrides" ADD CONSTRAINT "employee_permission_overrides_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_permission_overrides" ADD CONSTRAINT "employee_permission_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_permission_overrides" ADD CONSTRAINT "employee_permission_overrides_accorde_par_id_users_id_fk" FOREIGN KEY ("accorde_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_permission_overrides" ADD CONSTRAINT "employee_permission_overrides_revoque_par_id_users_id_fk" FOREIGN KEY ("revoque_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_emise_par_id_users_id_fk" FOREIGN KEY ("emise_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_confirmee_par_id_users_id_fk" FOREIGN KEY ("confirmee_par_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employee_permission_overrides_user_idx" ON "employee_permission_overrides" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employee_permission_overrides_store_idx" ON "employee_permission_overrides" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "payment_requests_store_idx" ON "payment_requests" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "payment_requests_statut_idx" ON "payment_requests" USING btree ("statut");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_agregateur_reference_unique" ON "payment_requests" USING btree ("agregateur_fournisseur","agregateur_reference") WHERE "payment_requests"."agregateur_reference" is not null;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_tarif_negocie_fixe_par_id_users_id_fk" FOREIGN KEY ("tarif_negocie_fixe_par_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_desactive_par_id_users_id_fk" FOREIGN KEY ("desactive_par_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_restaure_par_id_users_id_fk" FOREIGN KEY ("restaure_par_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_store_derniere_activite_idx" ON "devices" USING btree ("store_id","derniere_activite");--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id");