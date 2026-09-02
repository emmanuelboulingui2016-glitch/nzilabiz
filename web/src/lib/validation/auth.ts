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

/**
 * Un seul champ pour deux formes d'identifiant : le patron entre son adresse, ses employés leur
 * numéro. Le tri se fait sur la présence d'un « @ », côté serveur — demander à un vendeur de
 * choisir d'abord un onglet « e-mail » ou « téléphone » ajouterait une décision là où il n'y en a
 * pas : il n'a qu'un seul identifiant, il le tape.
 *
 * `email` reste accepté, facultatif, le temps que les onglets ouverts pendant le déploiement se
 * referment : ils enverraient encore l'ancienne forme, et leur propriétaire ne comprendrait pas
 * d'être refusé.
 */
export const loginSchema = z
  .object({
    identifiant: z.string().trim().min(1, "E-mail ou téléphone requis").optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Mot de passe requis"),
  })
  .transform((v) => ({ identifiant: v.identifiant || v.email || "", password: v.password }))
  .refine((v) => v.identifiant.length > 0, { message: "E-mail ou téléphone requis" });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
