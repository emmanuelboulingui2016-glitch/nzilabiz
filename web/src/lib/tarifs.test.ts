import { describe, expect, it } from "vitest";
import { economiePourcent, TARIFS_DEFAUT, type Grille } from "./tarifs";

describe("economiePourcent", () => {
  it("ne calcule aucune économie sur le cycle mensuel (référence de comparaison)", () => {
    expect(economiePourcent(TARIFS_DEFAUT, "ESSENTIEL", "mensuel")).toBe(0);
  });

  it("calcule l'économie du cycle trimestriel par rapport à 3 mensualités (cas nominal)", () => {
    // ESSENTIEL : 15 000 x 3 = 45 000 plein tarif, payé 40 000 → 11,1 % arrondi à 11.
    expect(economiePourcent(TARIFS_DEFAUT, "ESSENTIEL", "trimestriel")).toBe(11);
  });

  it("calcule l'économie du cycle annuel par rapport à 12 mensualités", () => {
    // ESSENTIEL : 15 000 x 12 = 180 000 plein tarif, payé 150 000 → 16,7 % arrondi à 17.
    expect(economiePourcent(TARIFS_DEFAUT, "ESSENTIEL", "annuel")).toBe(17);
  });

  it("calcule aussi l'économie pour la formule Premium", () => {
    expect(economiePourcent(TARIFS_DEFAUT, "PREMIUM", "trimestriel")).toBe(10);
    expect(economiePourcent(TARIFS_DEFAUT, "PREMIUM", "annuel")).toBe(17);
  });

  it("retourne 0 quand la formule n'a pas de tarif mensuel de référence (Entreprise)", () => {
    expect(economiePourcent(TARIFS_DEFAUT, "ENTREPRISE", "annuel")).toBe(0);
  });

  it("retourne 0 quand le cycle demandé n'a pas de montant dans la grille", () => {
    const grille: Grille = { ESSENTIEL: { mensuel: 1000 }, PREMIUM: {}, ENTREPRISE: {} };
    expect(economiePourcent(grille, "ESSENTIEL", "annuel")).toBe(0);
  });

  it("retourne 0 si le montant du cycle est supérieur ou égal au plein tarif (aucune remise)", () => {
    const grille: Grille = { ESSENTIEL: { mensuel: 1000, annuel: 20000 }, PREMIUM: {}, ENTREPRISE: {} };
    // plein tarif = 1000 x 12 = 12 000, payé 20 000 : plus cher, pas d'économie affichée.
    expect(economiePourcent(grille, "ESSENTIEL", "annuel")).toBe(0);
  });

  it("retourne 0 quand le tarif mensuel de référence est nul", () => {
    const grille: Grille = { ESSENTIEL: { mensuel: 0, annuel: 1000 }, PREMIUM: {}, ENTREPRISE: {} };
    expect(economiePourcent(grille, "ESSENTIEL", "annuel")).toBe(0);
  });
});
