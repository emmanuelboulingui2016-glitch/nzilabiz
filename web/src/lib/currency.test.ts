import { describe, expect, it } from "vitest";
import { formatFcfa, parseFcfaInput } from "./currency";

describe("formatFcfa", () => {
  it("sépare les milliers par un espace et ajoute la devise (cas nominal)", () => {
    expect(formatFcfa(292500)).toBe("292 500 FCFA");
  });

  it("accepte un montant sous forme de chaîne", () => {
    expect(formatFcfa("1200")).toBe("1 200 FCFA");
  });

  it("affiche 0 pour un montant nul", () => {
    expect(formatFcfa(0)).toBe("0 FCFA");
  });

  it("gère les montants négatifs", () => {
    expect(formatFcfa(-500)).toBe("-500 FCFA");
  });

  it("arrondit les montants décimaux (pas de centimes en FCFA)", () => {
    expect(formatFcfa(1234.6)).toBe("1 235 FCFA");
  });

  it("retombe sur 0 quand le montant n'est pas un nombre", () => {
    expect(formatFcfa(NaN)).toBe("0 FCFA");
    expect(formatFcfa("abc")).toBe("0 FCFA");
  });

  it("gère les très grands montants avec plusieurs groupes de milliers", () => {
    expect(formatFcfa(1234567890)).toBe("1 234 567 890 FCFA");
  });

  it("accepte une devise personnalisée", () => {
    expect(formatFcfa(1000000, "EUR")).toBe("1 000 000 EUR");
  });
});

describe("parseFcfaInput", () => {
  it("retire les espaces et le suffixe non numérique (cas nominal)", () => {
    expect(parseFcfaInput("12 500 FCFA")).toBe(12500);
  });

  it("convertit la virgule décimale en point", () => {
    expect(parseFcfaInput("1200,50")).toBe(1200.5);
  });

  it("accepte les montants négatifs", () => {
    expect(parseFcfaInput("-1500")).toBe(-1500);
  });

  it("retourne 0 pour une chaîne vide", () => {
    expect(parseFcfaInput("")).toBe(0);
  });

  it("retourne 0 quand la chaîne ne contient aucun chiffre exploitable", () => {
    expect(parseFcfaInput("abc")).toBe(0);
  });
});
