CREATE TYPE "public"."support_status" AS ENUM('OUVERT', 'EN_COURS', 'RESOLU', 'FERME');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"token" text NOT NULL,
	"role" "role" DEFAULT 'VENDEUR' NOT NULL,
	"nom_prevu" text,
	"email_prevu" text,
	"cree_par_id" text NOT NULL,
	"expire_le" timestamp NOT NULL,
	"utilise_le" timestamp,
	"utilise_par_id" text,
	"revoque_le" timestamp,
	"cree_le" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"nom_application" text DEFAULT 'NzilaBiz' NOT NULL,
	"slogan" text DEFAULT 'Gérez votre boutique, simplement, au quotidien' NOT NULL,
	"support_telephone" text,
	"support_whatsapp" text,
	"support_email" text,
	"support_horaires" text,
	"annonce" text,
	"annonce_active" boolean DEFAULT false NOT NULL,
	"editeur_raison_sociale" text,
	"editeur_forme_juridique" text,
	"editeur_adresse" text,
	"editeur_immatriculation" text,
	"editeur_directeur_publication" text,
	"hebergeur_nom" text,
	"hebergeur_adresse" text,
	"hebergeur_pays" text,
	"droit_applicable" text,
	"juridiction_competente" text,
	"autorite_protection_donnees" text,
	"facebook_url" text,
	"instagram_url" text,
	"tiktok_url" text,
	"mis_a_jour_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"user_id" text,
	"auteur_nom" text NOT NULL,
	"auteur_email" text NOT NULL,
	"sujet" text NOT NULL,
	"message" text NOT NULL,
	"statut" "support_status" DEFAULT 'OUVERT' NOT NULL,
	"reponse" text,
	"repondu_par_email" text,
	"repondu_le" timestamp,
	"cree_le" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_cree_par_id_users_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_utilise_par_id_users_id_fk" FOREIGN KEY ("utilise_par_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;