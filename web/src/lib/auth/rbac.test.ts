import { describe, expect, it } from "vitest";
import { can, permissionsFor, resoudrePermissions, type PermissionOverride, type Role } from "./rbac";

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
      // Le vendeur négocie le prix au comptoir : c'est voulu, pas un oubli de restriction.
      // Le patron peut lui retirer ce droit individuellement, et l'écart au catalogue est
      // conservé sur chaque ligne de vente.
      "vendre.prix.modifier",
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

// Chantier A — le patron ajoute ou retire des droits à un employé (dérogations individuelles,
// employeePermissionOverrides). C'est de la logique pure : matrice de rôle, puis dérogation active
// la plus récente sur chaque permission (voir le commentaire de schema.ts sur cette table).
describe("resoudrePermissions", () => {
  const derogation = (permission: PermissionOverride["permission"], action: PermissionOverride["action"], creeLe: Date): PermissionOverride => ({
    permission,
    action,
    creeLe,
  });

  it("sans dérogation, renvoie exactement la matrice du rôle", () => {
    expect(resoudrePermissions("VENDEUR", [])).toEqual(permissionsFor("VENDEUR"));
  });

  it("une dérogation ACCORDEE ajoute un droit que le rôle n'a pas", () => {
    const effectif = resoudrePermissions("VENDEUR", [
      derogation("stock.edit", "ACCORDEE", new Date("2026-01-01")),
    ]);
    expect(effectif).toContain("stock.edit");
    expect(permissionsFor("VENDEUR")).not.toContain("stock.edit");
  });

  it("une dérogation RETIREE enlève un droit que le rôle donne par défaut", () => {
    const effectif = resoudrePermissions("VENDEUR", [
      derogation("vendre.prix.modifier", "RETIREE", new Date("2026-01-01")),
    ]);
    expect(effectif).not.toContain("vendre.prix.modifier");
    expect(permissionsFor("VENDEUR")).toContain("vendre.prix.modifier");
  });

  it("n'affecte pas les autres permissions du rôle", () => {
    const effectif = resoudrePermissions("VENDEUR", [
      derogation("vendre.prix.modifier", "RETIREE", new Date("2026-01-01")),
    ]);
    expect(effectif).toContain("vendre.use");
    expect(effectif).toContain("stock.view");
  });

  it("entre deux dérogations actives sur la même permission, la plus récente l'emporte — peu importe l'ordre du tableau reçu", () => {
    const ancienne = derogation("stock.edit", "ACCORDEE", new Date("2026-01-01"));
    const recente = derogation("stock.edit", "RETIREE", new Date("2026-02-01"));

    expect(resoudrePermissions("VENDEUR", [ancienne, recente])).not.toContain("stock.edit");
    // Ordre inversé dans le tableau : même résultat, la fonction trie elle-même par date.
    expect(resoudrePermissions("VENDEUR", [recente, ancienne])).not.toContain("stock.edit");
  });

  it("une dérogation qui accorde un droit déjà donné par le rôle ne change rien", () => {
    const effectif = resoudrePermissions("PATRON", [
      derogation("dashboard.view", "ACCORDEE", new Date("2026-01-01")),
    ]);
    expect(effectif).toContain("dashboard.view");
  });

  it("une dérogation sur un GERANT peut lui donner un droit réservé au Patron", () => {
    const effectif = resoudrePermissions("GERANT", [
      derogation("parametres.utilisateurs", "ACCORDEE", new Date("2026-01-01")),
    ]);
    expect(effectif).toContain("parametres.utilisateurs");
  });
});

describe("can — avec dérogations (troisième paramètre optionnel)", () => {
  it("sans troisième argument, se comporte exactement comme avant (matrice de rôle seule)", () => {
    expect(can("VENDEUR", "stock.edit")).toBe(false);
    expect(can("VENDEUR", "vendre.prix.modifier")).toBe(true);
  });

  it("avec des dérogations, applique la résolution matrice + dérogation", () => {
    const overrides: PermissionOverride[] = [
      { permission: "stock.edit", action: "ACCORDEE", creeLe: new Date("2026-01-01") },
    ];
    expect(can("VENDEUR", "stock.edit", overrides)).toBe(true);
    expect(can("VENDEUR", "stock.edit")).toBe(false);
  });

  it("une dérogation RETIREE prend effet même si le tableau contient d'autres entrées non liées", () => {
    const overrides: PermissionOverride[] = [
      { permission: "vendre.prix.modifier", action: "RETIREE", creeLe: new Date("2026-01-01") },
      { permission: "stock.edit", action: "ACCORDEE", creeLe: new Date("2026-01-02") },
    ];
    expect(can("VENDEUR", "vendre.prix.modifier", overrides)).toBe(false);
    expect(can("VENDEUR", "stock.edit", overrides)).toBe(true);
    expect(can("VENDEUR", "stock.view", overrides)).toBe(true);
  });

  it("un tableau de dérogations vide se comporte comme la matrice pure", () => {
    expect(can("GERANT", "parametres.abonnement", [])).toBe(false);
  });
});
