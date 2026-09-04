import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

describe("registerSchema", () => {
  it("accepte une inscription complète (cas nominal)", () => {
    const résultat = registerSchema.safeParse({
      nom: "Jean Mabiala",
      email: "jean@gmail.com",
      password: "secret1",
      storeName: "Boutique Jean",
    });
    expect(résultat.success).toBe(true);
  });

  it("met l'adresse e-mail en minuscules et retire les espaces", () => {
    const résultat = registerSchema.safeParse({
      nom: "Jean",
      email: "  Jean@Gmail.COM  ",
      password: "secret1",
      storeName: "Boutique",
    });
    expect(résultat.success).toBe(true);
    if (résultat.success) expect(résultat.data.email).toBe("jean@gmail.com");
  });

  it("refuse un nom trop court", () => {
    const résultat = registerSchema.safeParse({
      nom: "J",
      email: "jean@gmail.com",
      password: "secret1",
      storeName: "Boutique",
    });
    expect(résultat.success).toBe(false);
    if (!résultat.success) expect(résultat.error.issues[0].message).toBe("Le nom est requis");
  });

  it("refuse un mot de passe de moins de 6 caractères", () => {
    const résultat = registerSchema.safeParse({
      nom: "Jean",
      email: "jean@gmail.com",
      password: "123",
      storeName: "Boutique",
    });
    expect(résultat.success).toBe(false);
    if (!résultat.success) expect(résultat.error.issues[0].message).toBe("6 caractères minimum");
  });

  it("refuse une adresse e-mail mal formée", () => {
    const résultat = registerSchema.safeParse({
      nom: "Jean",
      email: "pas-une-adresse",
      password: "secret1",
      storeName: "Boutique",
    });
    expect(résultat.success).toBe(false);
  });

  it("refuse un nom de boutique trop court", () => {
    const résultat = registerSchema.safeParse({
      nom: "Jean",
      email: "jean@gmail.com",
      password: "secret1",
      storeName: "B",
    });
    expect(résultat.success).toBe(false);
  });

  it("accepte un code testeur facultatif absent", () => {
    const résultat = registerSchema.safeParse({
      nom: "Jean",
      email: "jean@gmail.com",
      password: "secret1",
      storeName: "Boutique",
    });
    expect(résultat.success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepte un identifiant et un mot de passe (cas nominal)", () => {
    const résultat = loginSchema.safeParse({ identifiant: "077123456", password: "secret1" });
    expect(résultat.success).toBe(true);
    if (résultat.success) expect(résultat.data).toEqual({ identifiant: "077123456", password: "secret1" });
  });

  it("accepte un numéro de téléphone comme identifiant, sans validation de format e-mail", () => {
    const résultat = loginSchema.safeParse({ identifiant: "077123456", password: "secret1" });
    expect(résultat.success).toBe(true);
  });

  it("retombe sur le champ email historique quand identifiant est absent", () => {
    const résultat = loginSchema.safeParse({ email: "jean@gmail.com", password: "secret1" });
    expect(résultat.success).toBe(true);
    if (résultat.success) expect(résultat.data.identifiant).toBe("jean@gmail.com");
  });

  it("préfère identifiant à email quand les deux sont fournis", () => {
    const résultat = loginSchema.safeParse({
      identifiant: "077123456",
      email: "jean@gmail.com",
      password: "secret1",
    });
    expect(résultat.success).toBe(true);
    if (résultat.success) expect(résultat.data.identifiant).toBe("077123456");
  });

  it("refuse quand ni identifiant ni email ne sont fournis", () => {
    const résultat = loginSchema.safeParse({ password: "secret1" });
    expect(résultat.success).toBe(false);
    if (!résultat.success) expect(résultat.error.issues[0].message).toBe("E-mail ou téléphone requis");
  });

  it("refuse un mot de passe vide", () => {
    const résultat = loginSchema.safeParse({ identifiant: "077123456", password: "" });
    expect(résultat.success).toBe(false);
  });
});
