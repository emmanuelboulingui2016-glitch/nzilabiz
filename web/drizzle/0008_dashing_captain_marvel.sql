ALTER TABLE "platform_settings" ADD COLUMN "test_lien_code" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "test_lien_actif" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "test_lien_expire_le" timestamp;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "programme_test" boolean DEFAULT false NOT NULL;