import { describe, expect, it } from "vitest";
import { calculerPeriode, economiePourcent, TARIFS_DEFAUT, type Grille } from "./tarifs";

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

  it("Entreprise n'a plus aucun tarif par défaut — le prix se négocie, il ne se lit plus ici", () => {
    expect(TARIFS_DEFAUT.ENTREPRISE).toEqual({});
  });
});

describe("calculerPeriode", () => {
  const maintenant = new Date("2026-09-04T10:00:00.000Z");

  it("part d'aujourd'hui quand il n'y a aucune échéance en cours", () => {
    const { debut, fin } = calculerPeriode("mensuel", null, maintenant);
    expect(debut).toEqual(maintenant);
    expect(fin).toEqual(new Date("2026-10-04T10:00:00.000Z"));
  });

  it("part d'aujourd'hui quand l'échéance en cours est déjà dépassée (pas de mois offert)", () => {
    const echeancePassee = new Date("2026-08-01T00:00:00.000Z");
    const { debut, fin } = calculerPeriode("mensuel", echeancePassee, maintenant);
    expect(debut).toEqual(maintenant);
    expect(fin).toEqual(new Date("2026-10-04T10:00:00.000Z"));
  });

  it("prolonge depuis l'échéance en cours quand elle est encore future", () => {
    const echeanceFuture = new Date("2026-09-20T00:00:00.000Z");
    const { debut, fin } = calculerPeriode("mensuel", echeanceFuture, maintenant);
    expect(debut).toEqual(echeanceFuture);
    expect(fin).toEqual(new Date("2026-10-20T00:00:00.000Z"));
  });

  it("couvre trois mois pour le cycle trimestriel", () => {
    const { debut, fin } = calculerPeriode("trimestriel", null, maintenant);
    expect(debut).toEqual(maintenant);
    expect(fin).toEqual(new Date("2026-12-04T10:00:00.000Z"));
  });

  it("couvre douze mois pour le cycle annuel", () => {
    const { debut, fin } = calculerPeriode("annuel", null, maintenant);
    expect(debut).toEqual(maintenant);
    expect(fin).toEqual(new Date("2027-09-04T10:00:00.000Z"));
  });

  it("ne mute pas la date d'échéance passée en paramètre", () => {
    const echeanceFuture = new Date("2026-09-20T00:00:00.000Z");
    const copie = new Date(echeanceFuture);
    calculerPeriode("mensuel", echeanceFuture, maintenant);
    expect(echeanceFuture).toEqual(copie);
  });

  it("dépassement de fin de mois : repousse sur le mois suivant plutôt que de raccourcir (31 janvier + 1 mois)", () => {
    const debutJanvier31 = new Date("2026-01-31T00:00:00.000Z");
    const { fin } = calculerPeriode("mensuel", debutJanvier31, debutJanvier31);
    // Février n'a pas de 31 : le décalage se reporte au 3 mars plutôt que de tronquer au 28.
    expect(fin).toEqual(new Date("2026-03-03T00:00:00.000Z"));
  });
});
