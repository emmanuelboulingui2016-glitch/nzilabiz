CREATE TABLE "rate_limits" (
	"cle" text PRIMARY KEY NOT NULL,
	"fenetre_debut" timestamp with time zone DEFAULT now() NOT NULL,
	"compteur" integer DEFAULT 0 NOT NULL,
	"bloque_jusqua" timestamp with time zone
);
