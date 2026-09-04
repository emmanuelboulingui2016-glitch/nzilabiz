import { describe, expect, it } from "vitest";
import { formuleOuvre, messageHorsFormule, plafondComptes } from "./formules";

describe("formuleOuvre", () => {
  it("ESSAI ouvre tout, réseau compris", () => {
    expect(formuleOuvre("ESSAI", "depenses")).toBe(true);
    expect(formuleOuvre("ESSAI", "documents")).toBe(true);
    expect(formuleOuvre("ESSAI", "rapports")).toBe(true);
    expect(formuleOuvre("ESSAI", "devise")).toBe(true);
    expect(formuleOuvre("ESSAI", "reseau")).toBe(true);
  });

  it("ESSENTIEL ne restreint aucune fonctionnalité facturable — cas nominal du plafonnement", () => {
    expect(formuleOuvre("ESSENTIEL", "depenses")).toBe(false);
    expect(formuleOuvre("ESSENTIEL", "documents")).toBe(false);
    expect(formuleOuvre("ESSENTIEL", "rapports")).toBe(false);
    expect(formuleOuvre("ESSENTIEL", "devise")).toBe(false);
    expect(formuleOuvre("ESSENTIEL", "reseau")).toBe(false);
  });

  it("PREMIUM ouvre tout sauf le réseau multi-boutiques", () => {
    expect(formuleOuvre("PREMIUM", "depenses")).toBe(true);
    expect(formuleOuvre("PREMIUM", "documents")).toBe(true);
    expect(formuleOuvre("PREMIUM", "rapports")).toBe(true);
    expect(formuleOuvre("PREMIUM", "devise")).toBe(true);
    expect(formuleOuvre("PREMIUM", "reseau")).toBe(false);
  });

  it("ENTREPRISE ouvre tout, réseau compris", () => {
    expect(formuleOuvre("ENTREPRISE", "reseau")).toBe(true);
    expect(formuleOuvre("ENTREPRISE", "depenses")).toBe(true);
  });

  it("un plan inconnu ou vide retombe sur le comportement ESSAI (tout ouvert)", () => {
    expect(formuleOuvre("", "reseau")).toBe(true);
    expect(formuleOuvre("PLAN_INEXISTANT", "depenses")).toBe(true);
  });
});

describe("plafondComptes", () => {
  it("ESSENTIEL plafonne à 3 comptes", () => {
    expect(plafondComptes("ESSENTIEL")).toBe(3);
  });

  it("ESSAI, PREMIUM et ENTREPRISE sont illimités", () => {
    expect(plafondComptes("ESSAI")).toBeNull();
    expect(plafondComptes("PREMIUM")).toBeNull();
    expect(plafondComptes("ENTREPRISE")).toBeNull();
  });

  it("un plan inconnu retombe sur ESSAI (illimité)", () => {
    expect(plafondComptes("XYZ")).toBeNull();
  });
});

describe("messageHorsFormule", () => {
  it("mentionne la fonctionnalité concernée et invite à passer à Premium", () => {
    const message = messageHorsFormule("depenses");
    expect(message).toContain("Les dépenses");
    expect(message).toContain("Essentiel");
    expect(message).toContain("Premium");
  });

  it("varie le libellé selon la fonctionnalité", () => {
    expect(messageHorsFormule("reseau")).toContain("La gestion de plusieurs boutiques");
    expect(messageHorsFormule("devise")).toContain("Le changement de devise");
  });
});
