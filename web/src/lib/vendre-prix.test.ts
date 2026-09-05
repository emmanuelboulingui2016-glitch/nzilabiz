// Tests de `resolveItemPrice` — logique pure de résolution du prix d'une ligne de vente face au
// catalogue. Isolée dans src/lib/vendre-prix.ts (qui n'importe pas `db`) précisément pour rester
// testable ici sans base de données ni pooler Supavisor — voir le commentaire en tête de ce fichier.
//
// Contexte : § demande produit du 04/09 — remplace le seuil fixe de 20 % (qui aurait refusé une
// braderie de fin de stock légitime) par un contrôle de droit (`vendre.prix.modifier`) plus un
// enregistrement systématique du prix catalogue.

import { describe, expect, it } from "vitest";
import { CreateSaleError, resolveItemPrice } from "./vendre-prix";

describe("resolveItemPrice", () => {
  it("sans prix déclaré : renvoie le prix catalogue, sans divergence (chemin en ligne par défaut)", () => {
    const res = resolveItemPrice({
      nomProduit: "Savon",
      catalogPrixVente: 1500,
      prixDeclare: undefined,
      canModifierPrix: false,
    });
    expect(res).toEqual({ prixUnitaire: 1500, prixCatalogueUnitaire: 1500, divergence: false });
  });

  it("prix déclaré identique au catalogue : accepté même sans le droit, aucune divergence", () => {
    const res = resolveItemPrice({
      nomProduit: "Savon",
      catalogPrixVente: 1500,
      prixDeclare: 1500,
      canModifierPrix: false,
    });
    expect(res).toEqual({ prixUnitaire: 1500, prixCatalogueUnitaire: 1500, divergence: false });
  });

  it("avec le droit : accepte une braderie à -50 %, largement au-delà de l'ancien seuil de 20 %", () => {
    const res = resolveItemPrice({
      nomProduit: "Savon (fin de stock)",
      catalogPrixVente: 1500,
      prixDeclare: 750,
      canModifierPrix: true,
    });
    expect(res).toEqual({ prixUnitaire: 750, prixCatalogueUnitaire: 1500, divergence: true });
  });

  it("avec le droit : accepte aussi une hausse bien au-delà de l'ancien seuil de 20 %", () => {
    const res = resolveItemPrice({
      nomProduit: "Pièce rare",
      catalogPrixVente: 1000,
      prixDeclare: 5000,
      canModifierPrix: true,
    });
    expect(res).toEqual({ prixUnitaire: 5000, prixCatalogueUnitaire: 1000, divergence: true });
  });

  it("sans le droit : refuse tout écart, même minime (1 FCFA)", () => {
    expect(() =>
      resolveItemPrice({
        nomProduit: "Savon",
        catalogPrixVente: 1500,
        prixDeclare: 1501,
        canModifierPrix: false,
      })
    ).toThrow(CreateSaleError);
  });

  it("sans le droit : le refus est une erreur 403 (droit manquant), pas 400 (requête invalide)", () => {
    try {
      resolveItemPrice({
        nomProduit: "Savon",
        catalogPrixVente: 1500,
        prixDeclare: 900,
        canModifierPrix: false,
      });
      throw new Error("aurait dû lever une CreateSaleError");
    } catch (err) {
      expect(err).toBeInstanceOf(CreateSaleError);
      expect((err as CreateSaleError).status).toBe(403);
    }
  });

  it("refuse un prix négatif, même avec le droit de modifier le prix", () => {
    expect(() =>
      resolveItemPrice({
        nomProduit: "Savon",
        catalogPrixVente: 1500,
        prixDeclare: -100,
        canModifierPrix: true,
      })
    ).toThrow(CreateSaleError);
  });

  it("refuse NaN, même avec le droit", () => {
    expect(() =>
      resolveItemPrice({
        nomProduit: "Savon",
        catalogPrixVente: 1500,
        prixDeclare: Number.NaN,
        canModifierPrix: true,
      })
    ).toThrow(CreateSaleError);
  });

  it("refuse une valeur infinie, même avec le droit", () => {
    expect(() =>
      resolveItemPrice({
        nomProduit: "Savon",
        catalogPrixVente: 1500,
        prixDeclare: Number.POSITIVE_INFINITY,
        canModifierPrix: true,
      })
    ).toThrow(CreateSaleError);
  });

  it("accepte un prix nul (article offert) avec le droit", () => {
    const res = resolveItemPrice({
      nomProduit: "Échantillon",
      catalogPrixVente: 1500,
      prixDeclare: 0,
      canModifierPrix: true,
    });
    expect(res).toEqual({ prixUnitaire: 0, prixCatalogueUnitaire: 1500, divergence: true });
  });

  it("refuse un prix nul (article offert) sans le droit, si le catalogue n'est pas déjà à zéro", () => {
    expect(() =>
      resolveItemPrice({
        nomProduit: "Échantillon",
        catalogPrixVente: 1500,
        prixDeclare: 0,
        canModifierPrix: false,
      })
    ).toThrow(CreateSaleError);
  });

  it("FCFA : arrondit le prix déclaré à l'entier avant de comparer au catalogue", () => {
    // 1499.6 arrondi à 1500 == catalogue : aucune divergence, donc accepté même sans le droit.
    const res = resolveItemPrice({
      nomProduit: "Savon",
      catalogPrixVente: 1500,
      prixDeclare: 1499.6,
      canModifierPrix: false,
    });
    expect(res).toEqual({ prixUnitaire: 1500, prixCatalogueUnitaire: 1500, divergence: false });
  });

  it("catalogue à prix nul : un prix déclaré positif est bien une divergence nécessitant le droit", () => {
    expect(() =>
      resolveItemPrice({
        nomProduit: "Produit à prix libre",
        catalogPrixVente: 0,
        prixDeclare: 500,
        canModifierPrix: false,
      })
    ).toThrow(CreateSaleError);

    const res = resolveItemPrice({
      nomProduit: "Produit à prix libre",
      catalogPrixVente: 0,
      prixDeclare: 500,
      canModifierPrix: true,
    });
    expect(res).toEqual({ prixUnitaire: 500, prixCatalogueUnitaire: 0, divergence: true });
  });

  it("ne calcule jamais de prix d'achat : ce n'est pas le rôle de cette fonction (voir create-sale.ts, qui le résout toujours depuis le catalogue serveur)", () => {
    const res = resolveItemPrice({
      nomProduit: "Savon",
      catalogPrixVente: 1500,
      prixDeclare: 1000,
      canModifierPrix: true,
    });
    expect(res).not.toHaveProperty("prixAchatUnitaire");
  });
});
