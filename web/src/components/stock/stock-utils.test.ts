import { describe, expect, it } from "vitest";
import { computeStatut, normalizeHeader, toNumber } from "./stock-utils";

describe("computeStatut", () => {
  it("est en rupture à zéro (cas nominal)", () => {
    expect(computeStatut(0, 5)).toBe("rupture");
  });

  it("est en rupture pour un stock négatif (ajustement erroné)", () => {
    expect(computeStatut(-3, 5)).toBe("rupture");
  });

  it("est faible quand le stock est égal au seuil d'alerte", () => {
    expect(computeStatut(5, 5)).toBe("faible");
  });

  it("est faible sous le seuil d'alerte", () => {
    expect(computeStatut(2, 5)).toBe("faible");
  });

  it("est ok au-dessus du seuil d'alerte", () => {
    expect(computeStatut(6, 5)).toBe("ok");
  });

  it("est ok pour un stock positif avec un seuil d'alerte nul", () => {
    expect(computeStatut(1, 0)).toBe("ok");
  });
});

describe("toNumber", () => {
  it("convertit une chaîne numérique (cas nominal)", () => {
    expect(toNumber("12.5")).toBe(12.5);
  });

  it("retourne 0 pour null ou undefined", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it("retourne 0 pour une chaîne non numérique", () => {
    expect(toNumber("abc")).toBe(0);
  });

  it("laisse passer un nombre déjà typé", () => {
    expect(toNumber(10)).toBe(10);
  });

  it("retourne 0 pour une chaîne vide", () => {
    expect(toNumber("")).toBe(0);
  });
});

describe("normalizeHeader", () => {
  it("supprime les accents, la ponctuation et met en minuscules (cas nominal)", () => {
    expect(normalizeHeader("Prix d'Achat")).toBe("prixdachat");
  });

  it("gère les accents français des en-têtes de catalogue", () => {
    expect(normalizeHeader("Catégorie")).toBe("categorie");
  });

  it("retire les espaces internes et de bord", () => {
    expect(normalizeHeader("  Quantité Stock  ")).toBe("quantitestock");
  });

  it("reconnaît un alias de code-barres accentué", () => {
    expect(normalizeHeader("Éan13")).toBe("ean13");
  });

  it("retourne une chaîne vide pour une chaîne déjà vide", () => {
    expect(normalizeHeader("")).toBe("");
  });
});
