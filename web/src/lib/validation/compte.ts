import { z } from "zod";

// Même normalisation que pour l'inscription et la connexion (src/lib/validation/auth.ts) : sans
// elle, « Jean@Gmail.com » et « jean@gmail.com » seraient deux adresses différentes aux yeux de
// PostgreSQL, qui distingue la casse.
const email = z.string().trim().email("Adresse e-mail invalide").toLowerCase();

/**
 * Changement de l'adresse e-mail de la boutique (§ Paramètres → Mon compte). `motDePasse` est
 * facultatif au niveau du schéma : son caractère obligatoire dépend de si le compte en a un
 * (compte créé via Google), la route tranche — même logique que pour le changement de mot de passe
 * dans /api/parametres/securite.
 */
export const changerEmailSchema = z.object({
  motDePasse: z.string().optional(),
  nouvelEmail: email,
});

export type ChangerEmailInput = z.infer<typeof changerEmailSchema>;
