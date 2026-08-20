import { z } from "zod";

// Les adresses sont ramenées en minuscules et débarrassées des espaces avant toute comparaison.
// PostgreSQL distingue la casse : sans cette normalisation, « Jean@Gmail.com » et « jean@gmail.com »
// sont deux comptes différents. Un commerçant qui s'inscrit depuis son téléphone (majuscule
// automatique sur la première lettre) ne se reconnecterait plus depuis son ordinateur. La connexion
// Google, qui renvoie toujours l'adresse en minuscules, créerait de son côté une seconde boutique.
const email = z.string().trim().email("Adresse e-mail invalide").toLowerCase();

export const registerSchema = z.object({
  nom: z.string().trim().min(2, "Le nom est requis"),
  email,
  password: z.string().min(6, "6 caractères minimum"),
  storeName: z.string().trim().min(2, "Le nom de la boutique est requis"),
  // Code du programme de test, transmis par le lien testeur. Facultatif : l'inscription publique
  // reste ouverte, un code absent donne simplement l'essai standard.
  codeTest: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Mot de passe requis"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
