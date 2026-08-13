import { z } from "zod";

export const registerSchema = z.object({
  nom: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(6, "6 caractères minimum"),
  storeName: z.string().min(2, "Le nom de la boutique est requis"),
});

export const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
