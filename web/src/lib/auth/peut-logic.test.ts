import { describe, expect, it } from "vitest";
import { resoudrePeut } from "./peut-logic";

// `peut()` (session.ts) délègue sa décision à `resoudrePeut` pour rester testable sans base de
// données — voir peut-logic.ts pour le pourquoi. Ces tests couvrent donc la totalité de la logique
// de décision de `peut()`, à l'exception de la lecture en base elle-même (accesEtPermissions,
// permissionsEffectivesPour), qui ne peut pas s'exécuter hors d'une vraie connexion Postgres, comme
// le reste de session.ts.
describe("resoudrePeut", () => {
  it("refuse quand il n'y a pas d'acteur (session absente ou acteur introuvable)", () => {
    expect(resoudrePeut(null, "stock.edit")).toBe(false);
    expect(resoudrePeut(undefined, "stock.edit")).toBe(false);
  });

  it("accorde quand la permission fait partie des permissions déjà résolues", () => {
    expect(resoudrePeut({ permissions: ["stock.edit", "stock.view"] }, "stock.edit")).toBe(true);
  });

  it("refuse quand la permission n'y figure pas — y compris pour un rôle qui l'aurait par défaut", () => {
    // Le tableau reçu est déjà le résultat de resoudrePermissions (matrice + dérogations) : une
    // dérogation RETIREE se traduit ici par une simple absence dans le tableau, rien de spécial à
    // gérer côté `resoudrePeut`.
    expect(resoudrePeut({ permissions: ["stock.view"] }, "stock.edit")).toBe(false);
  });

  it("refuse pour un tableau de permissions vide", () => {
    expect(resoudrePeut({ permissions: [] }, "dashboard.view")).toBe(false);
  });
});
