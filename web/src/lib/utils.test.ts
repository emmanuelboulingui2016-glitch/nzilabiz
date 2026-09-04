import { describe, expect, it } from "vitest";
import { cn, genProductRef, genSaleNumber } from "./utils";

describe("genSaleNumber", () => {
  it("préfixe et complète à 4 chiffres (cas nominal)", () => {
    expect(genSaleNumber(1)).toBe("V-0001");
  });

  it("complète les petits numéros de séquence", () => {
    expect(genSaleNumber(23)).toBe("V-0023");
  });

  it("gère le numéro de séquence zéro", () => {
    expect(genSaleNumber(0)).toBe("V-0000");
  });

  it("ne tronque pas un numéro de séquence à plus de 4 chiffres", () => {
    expect(genSaleNumber(12345)).toBe("V-12345");
  });
});

describe("genProductRef", () => {
  it("génère une référence au format P- suivi de 5 caractères (cas nominal)", () => {
    expect(genProductRef()).toMatch(/^P-[A-Z0-9]{5}$/);
  });

  it("exclut les caractères ambigus I, O, 0 et 1 du corps de la référence", () => {
    for (let i = 0; i < 200; i++) {
      const ref = genProductRef();
      expect(ref.slice(2)).not.toMatch(/[IO01]/);
    }
  });
});

describe("cn", () => {
  it("fusionne les classes et résout les conflits Tailwind (cas nominal)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignore les valeurs falsy", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});
