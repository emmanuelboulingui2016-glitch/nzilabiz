import { describe, expect, it } from "vitest";
import {
  VALIDITE_MINUTES,
  dateExpiration,
  empreinte,
  messageJetonVerificationInvalide,
} from "./email-verification-token-regles";

// Uniquement la logique pure de ce fichier (voir son en-tête) : la création, la vérification et la
// consommation d'un jeton touchent `db` et vivent dans email-verification-token.ts, importé nulle
// part ici pour que ce test reste exécutable sans base de données (voir vitest.config.ts).

describe("empreinte", () => {
  it("est déterministe : le même jeton produit toujours la même empreinte", () => {
    const jeton = "un-jeton-tres-long-et-imprevisible-1234567890";
    expect(empreinte(jeton)).toBe(empreinte(jeton));
  });

  it("produit des empreintes différentes pour des jetons différents", () => {
    expect(empreinte("jeton-a-1234567890123456")).not.toBe(empreinte("jeton-b-1234567890123456"));
  });

  it("produit une empreinte SHA-256 (64 caractères hexadécimaux)", () => {
    expect(empreinte("n'importe quel jeton")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ne renvoie jamais le jeton en clair dans son empreinte", () => {
    const jeton = "secret-a-ne-jamais-stocker-en-clair";
    expect(empreinte(jeton)).not.toContain(jeton);
  });
});

describe("dateExpiration", () => {
  it("place l'expiration VALIDITE_MINUTES après l'instant donné", () => {
    const maintenant = new Date("2026-09-04T10:00:00.000Z");
    const attendu = new Date(maintenant.getTime() + VALIDITE_MINUTES * 60_000);
    expect(dateExpiration(maintenant).getTime()).toBe(attendu.getTime());
  });

  it("vaut 24 heures", () => {
    expect(VALIDITE_MINUTES).toBe(24 * 60);
  });

  it("par défaut, calcule à partir de l'instant présent", () => {
    const avant = Date.now();
    const expiration = dateExpiration();
    const apres = Date.now();
    expect(expiration.getTime()).toBeGreaterThanOrEqual(avant + VALIDITE_MINUTES * 60_000);
    expect(expiration.getTime()).toBeLessThanOrEqual(apres + VALIDITE_MINUTES * 60_000);
  });
});

describe("messageJetonVerificationInvalide", () => {
  it("explique une expiration en heures, cohérent avec VALIDITE_MINUTES", () => {
    expect(messageJetonVerificationInvalide("EXPIRE")).toContain("24 heures");
  });

  it("distingue un lien déjà utilisé", () => {
    expect(messageJetonVerificationInvalide("UTILISE")).toMatch(/déjà servi/);
  });

  it("distingue un compte fermé", () => {
    expect(messageJetonVerificationInvalide("COMPTE_FERME")).toMatch(/supprimé/);
  });

  it("donne un message générique pour un jeton introuvable", () => {
    expect(messageJetonVerificationInvalide("INTROUVABLE")).toMatch(/pas valable/);
  });
});
