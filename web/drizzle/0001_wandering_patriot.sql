CREATE TYPE "public"."document_status" AS ENUM('BROUILLON', 'EMISE', 'CONVERTIE', 'ANNULEE');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('FACTURE', 'PROFORMA', 'REMBOURSEMENT');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"type" "document_type" NOT NULL,
	"numero" text NOT NULL,
	"statut" "document_status" DEFAULT 'EMISE' NOT NULL,
	"sale_id" text,
	"client_id" text,
	"client_nom_libre" text,
	"items_brouillon" text,
	"montant_total" numeric(14, 2) NOT NULL,
	"convertie_en_vente_id" text,
	"user_id" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "prix_achat_unitaire" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_convertie_en_vente_id_sales_id_fk" FOREIGN KEY ("convertie_en_vente_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_store_numero_unique" ON "documents" USING btree ("store_id","numero");