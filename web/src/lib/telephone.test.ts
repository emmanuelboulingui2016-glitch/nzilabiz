import { describe, expect, it } from "vitest";
import { estAdresseEmail, formaterTelephone, normaliserTelephone } from "./telephone";

describe("normaliserTelephone", () => {
  it("normalise un numéro local gabonais avec zéro de tête", () => {
    expect(normaliserTelephone("077123456")).toBe("24177123456");
  });

  it("traite comme identiques les trois formes du même numéro (cas nominal)", () => {
    // Les trois écritures données en exemple dans le commentaire du module désignent le même abonné.
    const local = normaliserTelephone("07 00 00 00");
    const prefixeAvecEspaces = normaliserTelephone("+241 07 00 00 00");
    const brutSansSeparateur = normaliserTelephone("24107000000");
    expect(local).not.toBeNull();
    expect(local).toBe(prefixeAvecEspaces);
    expect(prefixeAvecEspaces).toBe(brutSansSeparateur);
  });

  it("ignore les caractères non numériques (espaces, tirets, parenthèses)", () => {
    expect(normaliserTelephone("(077) 12-34-56")).toBe("24177123456");
  });

  it("ne double pas l'indicatif déjà présent", () => {
    expect(normaliserTelephone("+24177123456")).toBe("24177123456");
    expect(normaliserTelephone("24177123456")).toBe("24177123456");
  });

  it("applique l'indicatif de la boutique quand il est fourni", () => {
    expect(normaliserTelephone("070000000", "+242")).toBe("24270000000");
  });

  it("retombe sur l'indicatif Gabon par défaut si celui de la boutique est vide", () => {
    expect(normaliserTelephone("070000000", "")).toBe(normaliserTelephone("070000000", null));
    expect(normaliserTelephone("070000000", undefined)).toBe("24170000000");
  });

  it("refuse une chaîne vide", () => {
    expect(normaliserTelephone("")).toBeNull();
  });

  it("refuse une chaîne sans aucun chiffre", () => {
    expect(normaliserTelephone("abc")).toBeNull();
    expect(normaliserTelephone("   ")).toBeNull();
  });

  it("refuse un numéro trop court une fois l'indicatif ajouté", () => {
    expect(normaliserTelephone("123")).toBeNull();
  });

  it("refuse un numéro composé uniquement de zéros", () => {
    expect(normaliserTelephone("0")).toBeNull();
    expect(normaliserTelephone("0000")).toBeNull();
  });

  it("refuse un numéro trop long", () => {
    expect(normaliserTelephone("1234567890123456789")).toBeNull();
  });

  it("accepte la borne basse de longueur (8 chiffres au total)", () => {
    // indicatif "241" (3) + national (>=5) : ici on force un national qui ne commence pas par
    // l'indicatif pour atteindre exactement 8 chiffres au total.
    const resultat = normaliserTelephone("99999", "241");
    expect(resultat).toBe("24199999");
    expect(resultat).not.toBeNull();
  });

  it("ne confond pas un numéro national qui commence par les mêmes chiffres que l'indicatif", () => {
    // "24112345" a 8 chiffres : en retirant l'indicatif "241" il ne resterait que "12345" (5
    // chiffres), sous la barre des 6 exigée pour considérer l'indicatif déjà présent. Le numéro est
    // donc traité comme purement national, préfixé une seconde fois.
    expect(normaliserTelephone("24112345")).toBe("24124112345");
  });
});

describe("formaterTelephone", () => {
  it("formate un numéro normalisé en groupes de deux chiffres (cas nominal)", () => {
    expect(formaterTelephone("24177123456")).toBe("+241 77 12 34 56");
  });

  it("ajoute un zéro de tête quand le national a un nombre impair de chiffres", () => {
    expect(formaterTelephone("2417000000")).toBe("+241 07 00 00 00");
  });

  it("retourne une chaîne vide pour une valeur absente", () => {
    expect(formaterTelephone(null)).toBe("");
    expect(formaterTelephone(undefined)).toBe("");
    expect(formaterTelephone("")).toBe("");
  });

  it("respecte l'indicatif de la boutique fourni", () => {
    expect(formaterTelephone("24270000000", "+242")).toBe("+242 70 00 00 00");
  });

  it("ne casse pas quand le numéro ne commence pas par l'indicatif attendu", () => {
    // Repli défensif : le national devient le numéro entier, sans retrait d'indicatif erroné.
    // Ici le numéro complet (9 chiffres, impair) reçoit lui-même un zéro de tête avant groupage.
    expect(formaterTelephone("990000000", "241")).toBe("+241 09 90 00 00 00");
  });
});

describe("estAdresseEmail", () => {
  it("reconnaît une adresse e-mail", () => {
    expect(estAdresseEmail("jean@gmail.com")).toBe(true);
  });

  it("reconnaît un numéro de téléphone comme non-email", () => {
    expect(estAdresseEmail("077123456")).toBe(false);
  });

  it("traite une chaîne vide comme un numéro (pas un email)", () => {
    expect(estAdresseEmail("")).toBe(false);
  });
});
