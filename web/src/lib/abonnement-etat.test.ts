import { describe, expect, it } from "vitest";
import { echeanceDepassee, joursRestantsAvant, messageBlocage } from "./abonnement-etat";

const JOUR_MS = 24 * 60 * 60 * 1000;

describe("joursRestantsAvant", () => {
  it("compte un jour restant tout juste avant l'échéance (cas nominal)", () => {
    const maintenant = Date.now();
    expect(joursRestantsAvant(new Date(maintenant + JOUR_MS), maintenant)).toBe(1);
  });

  it("arrondit au jour supérieur une échéance à moins de 24h", () => {
    const maintenant = Date.now();
    expect(joursRestantsAvant(new Date(maintenant + JOUR_MS / 2), maintenant)).toBe(1);
  });

  it("retourne 0 le jour même de l'échéance", () => {
    const maintenant = Date.now();
    expect(joursRestantsAvant(new Date(maintenant), maintenant)).toBe(0);
  });

  it("retourne une valeur négative une fois l'échéance dépassée", () => {
    const maintenant = Date.now();
    expect(joursRestantsAvant(new Date(maintenant - 2 * JOUR_MS), maintenant)).toBe(-2);
  });
});

describe("echeanceDepassee", () => {
  it("n'est pas dépassée tant que l'échéance est dans le futur", () => {
    const maintenant = Date.now();
    expect(echeanceDepassee(new Date(maintenant + 1), maintenant)).toBe(false);
  });

  it("est dépassée exactement au moment de l'échéance (borne incluse)", () => {
    const maintenant = Date.now();
    expect(echeanceDepassee(new Date(maintenant), maintenant)).toBe(true);
  });

  it("est dépassée une fois l'échéance passée", () => {
    const maintenant = Date.now();
    expect(echeanceDepassee(new Date(maintenant - 1), maintenant)).toBe(true);
  });
});

describe("messageBlocage", () => {
  it("distingue le message de fin d'essai de celui de fin d'abonnement", () => {
    expect(messageBlocage("ESSAI_EXPIRE")).toBe("Votre période d'essai est terminée.");
    expect(messageBlocage("ABONNEMENT_EXPIRE")).toBe("Votre abonnement est arrivé à échéance.");
  });
});
