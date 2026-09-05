import { describe, expect, it } from "vitest";
import { changerEmailSchema } from "./compte";

describe("changerEmailSchema", () => {
  it("accepte une demande complète (cas nominal)", () => {
    const résultat = changerEmailSchema.safeParse({
      motDePasse: "secret1",
      nouvelEmail: "nouvelle@gmail.com",
    });
    expect(résultat.success).toBe(true);
  });

  it("accepte l'absence de mot de passe au niveau du schéma (tranché par la route)", () => {
    const résultat = changerEmailSchema.safeParse({ nouvelEmail: "nouvelle@gmail.com" });
    expect(résultat.success).toBe(true);
  });

  it("met la nouvelle adresse en minuscules et retire les espaces", () => {
    const résultat = changerEmailSchema.safeParse({
      nouvelEmail: "  Nouvelle@Gmail.COM  ",
    });
    expect(résultat.success).toBe(true);
    if (résultat.success) expect(résultat.data.nouvelEmail).toBe("nouvelle@gmail.com");
  });

  it("refuse une adresse mal formée", () => {
    const résultat = changerEmailSchema.safeParse({ nouvelEmail: "pas-une-adresse" });
    expect(résultat.success).toBe(false);
  });

  it("refuse une adresse absente", () => {
    const résultat = changerEmailSchema.safeParse({ motDePasse: "secret1" });
    expect(résultat.success).toBe(false);
  });
});
