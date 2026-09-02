ALTER TABLE "support_tickets" ALTER COLUMN "auteur_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "auteur_telephone" text;