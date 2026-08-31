ALTER TYPE "public"."subscription_plan" ADD VALUE 'ESSENTIEL' BEFORE 'PREMIUM';--> statement-breakpoint
CREATE TABLE "plan_tarifs" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"cycle" text NOT NULL,
	"montant" numeric(14, 2) NOT NULL,
	"mis_a_jour_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "plan_tarifs_plan_cycle_unique" ON "plan_tarifs" USING btree ("plan","cycle");