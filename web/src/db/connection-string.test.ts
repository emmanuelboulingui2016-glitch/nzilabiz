import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectionStringRequise, estModeTransaction } from "./connection-string";

describe("connectionStringRequise", () => {
  const original = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("retourne la chaîne de connexion quand elle est définie (cas nominal)", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    expect(connectionStringRequise()).toBe("postgresql://user:pass@localhost:5432/db");
  });

  it("retire les espaces autour de la valeur", () => {
    process.env.DATABASE_URL = "  postgresql://user:pass@localhost:5432/db  ";
    expect(connectionStringRequise()).toBe("postgresql://user:pass@localhost:5432/db");
  });

  it("lève une erreur explicite quand la variable est absente", () => {
    expect(() => connectionStringRequise()).toThrow(/DATABASE_URL est absent/);
  });

  it("mentionne le contexte fourni dans le message d'erreur", () => {
    expect(() => connectionStringRequise("le script de migration")).toThrow(/le script de migration/);
  });

  it("lève une erreur pour une valeur composée uniquement d'espaces", () => {
    process.env.DATABASE_URL = "   ";
    expect(() => connectionStringRequise()).toThrow(/DATABASE_URL est absent/);
  });
});

describe("estModeTransaction", () => {
  it("détecte le pooler Supabase en mode transaction sur le port 6543 (cas nominal)", () => {
    expect(estModeTransaction("postgresql://user:pass@aws.pooler.supabase.com:6543/postgres")).toBe(true);
  });

  it("détecte le mode transaction via le paramètre pgbouncer=true, même sur un autre port", () => {
    expect(estModeTransaction("postgresql://user:pass@host:5432/db?pgbouncer=true")).toBe(true);
  });

  it("ne confond pas le pooler session (port 5432) avec le mode transaction", () => {
    expect(estModeTransaction("postgresql://user:pass@aws.pooler.supabase.com:5432/postgres")).toBe(false);
  });

  it("reconnaît le port 6543 suivi d'une chaîne de requête", () => {
    expect(estModeTransaction("postgresql://user:pass@host:6543/db?sslmode=require")).toBe(true);
  });

  it("retourne faux pour une connexion locale sans port spécial", () => {
    expect(estModeTransaction("postgresql://nzilabiz:motdepasse@localhost:5432/nzilabiz")).toBe(false);
  });
});
