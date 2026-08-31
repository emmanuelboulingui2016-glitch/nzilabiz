CREATE TABLE "store_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"store_id" text NOT NULL,
	"role" "role" DEFAULT 'PATRON' NOT NULL,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "maison_mere_id" text;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_memberships" ADD CONSTRAINT "store_memberships_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_memberships_user_store_unique" ON "store_memberships" USING btree ("user_id","store_id");--> statement-breakpoint
CREATE INDEX "store_memberships_user_idx" ON "store_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "store_memberships_store_idx" ON "store_memberships" USING btree ("store_id");--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_maison_mere_id_stores_id_fk" FOREIGN KEY ("maison_mere_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stores_maison_mere_idx" ON "stores" USING btree ("maison_mere_id");