import { describe, expect, it } from "vitest";
import { can, permissionsFor, type Role } from "./rbac";

describe("can", () => {
  it("PATRON a un accès complet, y compris les réglages sensibles (cas nominal)", () => {
    expect(can("PATRON", "parametres.abonnement")).toBe(true);
    expect(can("PATRON", "parametres.utilisateurs")).toBe(true);
    expect(can("PATRON", "boutiques.reseau")).toBe(true);
    expect(can("PATRON", "ventes.annuler.direct")).toBe(true);
  });

  it("GERANT n'a pas accès aux réglages d'abonnement ni au réseau de boutiques", () => {
    expect(can("GERANT", "parametres.abonnement")).toBe(false);
    expect(can("GERANT", "boutiques.reseau")).toBe(false);
    expect(can("GERANT", "parametres.utilisateurs")).toBe(false);
  });

  it("GERANT doit demander une validation pour annuler une vente, pas l'annuler directement", () => {
    expect(can("GERANT", "ventes.annuler.direct")).toBe(false);
    expect(can("GERANT", "ventes.annuler.demander")).toBe(true);
  });

  it("VENDEUR est limité à vendre et à son propre historique", () => {
    expect(can("VENDEUR", "vendre.use")).toBe(true);
    expect(can("VENDEUR", "ventes.view.own")).toBe(true);
    expect(can("VENDEUR", "ventes.view.all")).toBe(false);
  });

  it("VENDEUR ne peut jamais annuler une vente sans validation", () => {
    expect(can("VENDEUR", "ventes.annuler.direct")).toBe(false);
    expect(can("VENDEUR", "ventes.annuler.demander")).toBe(true);
  });

  it("VENDEUR n'a pas accès au stock en écriture, aux clients ni aux dépenses", () => {
    expect(can("VENDEUR", "stock.edit")).toBe(false);
    expect(can("VENDEUR", "clients.view")).toBe(false);
    expect(can("VENDEUR", "depenses.view")).toBe(false);
  });

  it("refuse par défaut un rôle inconnu, sans lever d'exception", () => {
    expect(can("INEXISTANT" as Role, "dashboard.view")).toBe(false);
  });
});

describe("permissionsFor", () => {
  it("renvoie la liste complète des permissions d'un rôle", () => {
    expect(permissionsFor("VENDEUR")).toEqual([
      "dashboard.view",
      "vendre.use",
      "ventes.view.own",
      "ventes.annuler.demander",
      "stock.view",
    ]);
  });

  it("PATRON a strictement plus de permissions que GERANT, qui en a plus que VENDEUR", () => {
    expect(permissionsFor("PATRON").length).toBeGreaterThan(permissionsFor("GERANT").length);
    expect(permissionsFor("GERANT").length).toBeGreaterThan(permissionsFor("VENDEUR").length);
  });

  it("renvoie un tableau vide pour un rôle inconnu plutôt que de lever une exception", () => {
    expect(permissionsFor("INEXISTANT" as Role)).toEqual([]);
  });
});
