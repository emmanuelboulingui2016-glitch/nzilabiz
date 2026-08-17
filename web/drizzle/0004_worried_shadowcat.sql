CREATE TABLE "mobile_money_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"operateur_prioritaire" text DEFAULT 'AIRTEL_MONEY' NOT NULL,
	"numero_marchand_airtel" text,
	"numero_marchand_moov" text,
	"agregateur_site_id" text,
	"agregateur_api_key" text,
	"mode_production" boolean DEFAULT false NOT NULL,
	"mis_a_jour_le" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_money_settings_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "taux_change_manuel" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "desactive_le" timestamp;--> statement-breakpoint
ALTER TABLE "mobile_money_settings" ADD CONSTRAINT "mobile_money_settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;