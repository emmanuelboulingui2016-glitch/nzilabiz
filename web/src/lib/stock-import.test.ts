import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { detecterFormat, ligneExploitable, lireLignes, parseNumber, pickField } from "./stock-import";

function classeurXlsx(lignes: (string | number)[][]): Buffer {
  const feuille = XLSX.utils.aoa_to_sheet(lignes);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Produits");
  return XLSX.write(classeur, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

describe("detecterFormat", () => {
  it("reconnaît un classeur Excel à sa signature ZIP, même avec la mauvaise extension", () => {
    const buffer = classeurXlsx([["nom"], ["Riz"]]);
    expect(detecterFormat("export.csv", buffer)).toBe("xlsx");
  });

  it("retombe sur l'extension .xlsx quand le contenu ne commence pas par la signature ZIP", () => {
    expect(detecterFormat("produits.xlsx", Buffer.from("pas vraiment un classeur"))).toBe("xlsx");
  });

  it("détecte un CSV (cas nominal, avant le retrait du format — comportement de repli)", () => {
    expect(detecterFormat("produits.csv", Buffer.from("nom,prix\nRiz,500"))).toBe("csv");
  });

  it("ne plante pas sur un buffer vide", () => {
    expect(detecterFormat("produits.csv", Buffer.alloc(0))).toBe("csv");
  });
});

describe("lireLignes", () => {
  it("lit un classeur xlsx réel produit par le modèle (cas nominal)", () => {
    const buffer = classeurXlsx([
      ["nom", "categorie", "prixAchat", "prixVente"],
      ["Riz 5kg", "Alimentation", 4500, 5500],
    ]);
    const lignes = lireLignes("xlsx", buffer);
    expect(lignes).toEqual([{ nom: "Riz 5kg", categorie: "Alimentation", prixAchat: 4500, prixVente: 5500 }]);
  });

  it("lit un CSV avec en-têtes", () => {
    const buffer = Buffer.from("nom,prixAchat,prixVente\nRiz,500,600\n", "utf-8");
    const lignes = lireLignes("csv", buffer);
    expect(lignes).toEqual([{ nom: "Riz", prixAchat: "500", prixVente: "600" }]);
  });

  // Le classeur « sans aucune feuille » (branche défensive `if (!nomPremiereFeuille) return []`)
  // n'est pas testé ici : SheetJS refuse d'écrire un classeur sans feuille, et le namespace ESM du
  // module ne peut pas être « spié » pour simuler cette lecture (voir rapport de tests).

  it("borne le nombre de lignes lues quand maxLignes est fourni", () => {
    const buffer = classeurXlsx([
      ["nom"],
      ["Riz"],
      ["Huile"],
      ["Sucre"],
    ]);
    const lignes = lireLignes("xlsx", buffer, 2); // en-tête + 1 ligne de données
    expect(lignes).toEqual([{ nom: "Riz" }]);
  });
});

describe("ligneExploitable", () => {
  it("rejette une ligne entièrement vide", () => {
    expect(ligneExploitable({ nom: "", prix: null, stock: undefined })).toBe(false);
  });

  it("rejette une ligne dont les valeurs ne sont que des espaces", () => {
    expect(ligneExploitable({ nom: "   " })).toBe(false);
  });

  it("accepte une ligne avec au moins une valeur non vide (cas nominal)", () => {
    expect(ligneExploitable({ nom: "Riz", prix: "" })).toBe(true);
  });

  it("n'ignore pas une ligne dont la seule valeur renseignée est zéro", () => {
    // Une quantité ou un seuil à 0 est une donnée valide, pas une ligne vide.
    expect(ligneExploitable({ nom: "", quantiteStock: 0 })).toBe(true);
  });
});

describe("pickField", () => {
  it("retrouve un champ via un alias accentué et ponctué (cas nominal)", () => {
    expect(pickField({ "Prix d'Achat": "4500" }, "prixAchat")).toBe("4500");
  });

  it("convertit une valeur numérique de cellule Excel en chaîne", () => {
    expect(pickField({ "Prix Vente": 500 }, "prixVente")).toBe("500");
  });

  it("retourne undefined quand aucun alias ne correspond", () => {
    expect(pickField({ "Colonne Mystère": "valeur" }, "nom")).toBeUndefined();
  });

  it("retourne undefined pour une valeur vide ou nulle", () => {
    expect(pickField({ nom: "" }, "nom")).toBeUndefined();
    expect(pickField({ nom: null }, "nom")).toBeUndefined();
  });
});

describe("parseNumber", () => {
  it("retire les espaces de milliers et convertit la virgule (cas nominal)", () => {
    expect(parseNumber("1 500,50", 0)).toBe(1500.5);
  });

  it("utilise la valeur de repli quand le champ est absent", () => {
    expect(parseNumber(undefined, 5)).toBe(5);
  });

  it("utilise la valeur de repli pour une chaîne non numérique", () => {
    expect(parseNumber("abc", 42)).toBe(42);
  });

  it("ne remplace pas un zéro explicite par la valeur de repli", () => {
    expect(parseNumber("0", 5)).toBe(0);
  });

  it("accepte les nombres négatifs", () => {
    expect(parseNumber("-100", 0)).toBe(-100);
  });
});
