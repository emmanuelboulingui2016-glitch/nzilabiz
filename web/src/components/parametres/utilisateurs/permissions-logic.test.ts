import { describe, expect, it } from "vitest";
import {
  calculerExpirationRestauration,
  derniereDerogationParUtilisateur,
  estAujourdHuiPourLeCommercant,
  resoudreAdministrateurs,
  restaurationExpiree,
  type MembreBoutique,
} from "./permissions-logic";

// Ce fichier importe permissions-logic.ts, jamais queries.ts : queries.ts importe `db` au niveau
// module (voir src/db/client.ts), et le simple `import` déclencherait la lecture de DATABASE_URL,
// absente dans cet environnement de test. Voir l'en-tête de permissions-logic.ts pour le pourquoi.

// Chantier A — garde-fou « ne jamais laisser la boutique sans personne pour administrer les
// utilisateurs ». Logique pure, testable sans base de données.
describe("resoudreAdministrateurs", () => {
  it("un Patron seul est administrateur par son rôle, sans dérogation", () => {
    const membres: MembreBoutique[] = [{ id: "patron-1", role: "PATRON" }];
    const resultat = resoudreAdministrateurs(membres, new Map());
    expect(resultat.get("patron-1")).toBe(true);
  });

  it("un Gérant ou un Vendeur n'administre pas par défaut", () => {
    const membres: MembreBoutique[] = [
      { id: "gerant-1", role: "GERANT" },
      { id: "vendeur-1", role: "VENDEUR" },
    ];
    const resultat = resoudreAdministrateurs(membres, new Map());
    expect(resultat.get("gerant-1")).toBe(false);
    expect(resultat.get("vendeur-1")).toBe(false);
  });

  it("une dérogation ACCORDEE rend un Gérant administrateur", () => {
    const membres: MembreBoutique[] = [{ id: "gerant-1", role: "GERANT" }];
    const derogations = new Map<string, "ACCORDEE" | "RETIREE">([["gerant-1", "ACCORDEE"]]);
    expect(resoudreAdministrateurs(membres, derogations).get("gerant-1")).toBe(true);
  });

  it("une dérogation RETIREE retire le droit à un Patron", () => {
    const membres: MembreBoutique[] = [{ id: "patron-1", role: "PATRON" }];
    const derogations = new Map<string, "ACCORDEE" | "RETIREE">([["patron-1", "RETIREE"]]);
    expect(resoudreAdministrateurs(membres, derogations).get("patron-1")).toBe(false);
  });

  it("permet de détecter le cas « plus personne pour administrer » (le scénario du dimanche soir)", () => {
    const membres: MembreBoutique[] = [
      { id: "patron-1", role: "PATRON" },
      { id: "vendeur-1", role: "VENDEUR" },
    ];
    const derogations = new Map<string, "ACCORDEE" | "RETIREE">([["patron-1", "RETIREE"]]);
    const resultat = resoudreAdministrateurs(membres, derogations);
    const nombreAdmins = [...resultat.values()].filter(Boolean).length;
    expect(nombreAdmins).toBe(0);
  });
});

describe("derniereDerogationParUtilisateur", () => {
  it("garde la dérogation la plus récente quand plusieurs sont actives pour le même utilisateur", () => {
    const lignes = [
      { userId: "u1", action: "ACCORDEE" as const, creeLe: new Date("2026-01-01") },
      { userId: "u1", action: "RETIREE" as const, creeLe: new Date("2026-03-01") },
    ];
    const resultat = derniereDerogationParUtilisateur(lignes);
    expect(resultat.get("u1")).toBe("RETIREE");
  });

  it("ne mélange pas les utilisateurs entre eux", () => {
    const lignes = [
      { userId: "u1", action: "ACCORDEE" as const, creeLe: new Date("2026-01-01") },
      { userId: "u2", action: "RETIREE" as const, creeLe: new Date("2026-01-01") },
    ];
    const resultat = derniereDerogationParUtilisateur(lignes);
    expect(resultat.get("u1")).toBe("ACCORDEE");
    expect(resultat.get("u2")).toBe("RETIREE");
  });
});

// Chantier C — « aujourd'hui » doit être aujourd'hui pour le commerçant (Africa/Libreville), pas
// pour le serveur qui exécute le code.
describe("estAujourdHuiPourLeCommercant", () => {
  it("vrai pour deux horodatages du même jour civil à Libreville", () => {
    // 23h locale Libreville (UTC+1) le 3 = 22h UTC le 3 ; 21h locale le 3 = 20h UTC le 3.
    const soir = new Date("2026-09-03T22:00:00.000Z");
    const referenceMemeJour = new Date("2026-09-03T20:00:00.000Z");
    expect(estAujourdHuiPourLeCommercant(soir, referenceMemeJour)).toBe(true);
  });

  it("distingue un jour civil différent même si les horodatages UTC sont proches (bascule de minuit)", () => {
    // 23h50 locale Libreville le 3 (= 22h50 UTC le 3) vs 00h10 locale le 4 (= 23h10 UTC le 3) :
    // moins d'une heure d'écart en UTC, mais deux jours différents pour le commerçant.
    const juisteAvantMinuitLocal = new Date("2026-09-03T22:50:00.000Z");
    const juisteApresMinuitLocal = new Date("2026-09-03T23:10:00.000Z");
    expect(estAujourdHuiPourLeCommercant(juisteAvantMinuitLocal, juisteApresMinuitLocal)).toBe(false);
  });

  it("faux pour deux jours clairement différents", () => {
    const hier = new Date("2026-09-02T12:00:00.000Z");
    const aujourdhui = new Date("2026-09-03T12:00:00.000Z");
    expect(estAujourdHuiPourLeCommercant(hier, aujourdhui)).toBe(false);
  });
});

// Chantier B — fenêtre de restauration de 48h d'un compte supprimé par le patron.
describe("calculerExpirationRestauration / restaurationExpiree", () => {
  it("l'échéance calculée tombe exactement 48h après l'instant donné", () => {
    const suppression = new Date("2026-09-03T10:00:00.000Z");
    const expiration = calculerExpirationRestauration(suppression);
    expect(expiration.getTime() - suppression.getTime()).toBe(48 * 60 * 60 * 1000);
  });

  it("n'est pas expirée juste avant l'échéance", () => {
    const suppression = new Date("2026-09-03T10:00:00.000Z");
    const expiration = calculerExpirationRestauration(suppression);
    const uneMinuteAvant = new Date(expiration.getTime() - 60_000);
    expect(restaurationExpiree(expiration, uneMinuteAvant)).toBe(false);
  });

  it("est expirée pile à l'échéance et après", () => {
    const suppression = new Date("2026-09-03T10:00:00.000Z");
    const expiration = calculerExpirationRestauration(suppression);
    expect(restaurationExpiree(expiration, expiration)).toBe(true);
    expect(restaurationExpiree(expiration, new Date(expiration.getTime() + 1))).toBe(true);
  });

  it("utilise l'instant présent par défaut quand aucune référence n'est fournie", () => {
    const expirationPassee = new Date(Date.now() - 1000);
    expect(restaurationExpiree(expirationPassee)).toBe(true);
  });
});
