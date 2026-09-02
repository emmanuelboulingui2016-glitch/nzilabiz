ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telephone" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_telephone_unique" UNIQUE("telephone");