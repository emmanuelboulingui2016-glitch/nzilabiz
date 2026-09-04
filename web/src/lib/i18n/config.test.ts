import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isRtl, LOCALES } from "./config";

describe("isRtl", () => {
  it("l'arabe s'affiche de droite à gauche (cas nominal)", () => {
    expect(isRtl("ar")).toBe(true);
  });

  it("le français et l'anglais s'affichent de gauche à droite", () => {
    expect(isRtl("fr")).toBe(false);
    expect(isRtl("en")).toBe(false);
  });
});

describe("configuration des langues", () => {
  it("expose les trois langues supportées", () => {
    expect(LOCALES).toEqual(["fr", "en", "ar"]);
  });

  it("le français est la langue par défaut", () => {
    expect(DEFAULT_LOCALE).toBe("fr");
  });
});
