import { describe, expect, it } from "vitest";
import { imageEnvoyee, justificatifEnvoye, refusJustificatif, TAILLE_MAX_CARACTERES } from "./fichier";

describe("imageEnvoyee", () => {
  it("accepte une image encodée en base64 (cas nominal)", () => {
    expect(imageEnvoyee.safeParse("data:image/png;base64,AAAA").success).toBe(true);
  });

  it("accepte une chaîne vide (aucune image envoyée)", () => {
    expect(imageEnvoyee.safeParse("").success).toBe(true);
  });

  it("accepte une URL distante en https", () => {
    expect(imageEnvoyee.safeParse("https://exemple.com/photo.jpg").success).toBe(true);
  });

  it("refuse une URL distante en http (non chiffrée)", () => {
    expect(imageEnvoyee.safeParse("http://exemple.com/photo.jpg").success).toBe(false);
  });

  it("refuse un PDF (réservé aux justificatifs)", () => {
    expect(imageEnvoyee.safeParse("data:application/pdf;base64,AAAA").success).toBe(false);
  });

  it("refuse un fichier trop volumineux", () => {
    const trop_long = "data:image/png;base64," + "A".repeat(TAILLE_MAX_CARACTERES + 1);
    const résultat = imageEnvoyee.safeParse(trop_long);
    expect(résultat.success).toBe(false);
    if (!résultat.success) expect(résultat.error.issues[0].message).toContain("trop volumineux");
  });
});

describe("justificatifEnvoye", () => {
  it("accepte un PDF (cas nominal)", () => {
    expect(justificatifEnvoye.safeParse("data:application/pdf;base64,AAAA").success).toBe(true);
  });

  it("accepte aussi une image", () => {
    expect(justificatifEnvoye.safeParse("data:image/jpeg;base64,AAAA").success).toBe(true);
  });

  it("refuse un format texte brut", () => {
    expect(justificatifEnvoye.safeParse("data:text/plain;base64,AAAA").success).toBe(false);
  });
});

describe("refusJustificatif", () => {
  it("n'objecte rien pour une valeur absente (cas nominal)", () => {
    expect(refusJustificatif(null)).toBeNull();
    expect(refusJustificatif(undefined)).toBeNull();
    expect(refusJustificatif("")).toBeNull();
  });

  it("accepte un justificatif valide", () => {
    expect(refusJustificatif("data:application/pdf;base64,AAAA")).toBeNull();
  });

  it("refuse une valeur qui n'est pas une chaîne", () => {
    expect(refusJustificatif(12345)).toBe("Ce justificatif n'est pas dans un format accepté.");
  });

  it("refuse une chaîne mal formée", () => {
    expect(refusJustificatif("pas-un-fichier")).toBe("Ce justificatif n'est pas dans un format accepté.");
  });
});
