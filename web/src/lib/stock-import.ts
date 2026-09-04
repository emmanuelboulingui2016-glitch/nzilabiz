/**
 * Import de produits en masse — logique de LECTURE et de mapping, isolée de
 * `src/app/api/stock/products/import/route.ts` pour rester testable sans base de données.
 *
 * La route reste seule responsable de l'écriture (création des catégories, détection de doublon
 * par code-barres, insertion) : ce fichier ne fait que transformer des octets bruts en lignes
 * exploitables, et lire un champ produit dans une ligne selon les alias de colonnes tolérés.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CSV_FIELD_ALIASES, normalizeHeader } from "@/components/stock/stock-utils";

/**
 * Devine le format du fichier envoyé. Le contenu prime sur le nom : un classeur Excel est en
 * réalité une archive ZIP et commence toujours par la signature "PK", quelle que soit l'extension
 * déclarée. Le nom de fichier ne sert que de repli si le contenu est ambigu (fichier vide, etc.).
 */
export function detecterFormat(nomFichier: string, buffer: Buffer): "xlsx" | "csv" {
  const estArchiveZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (estArchiveZip) return "xlsx";
  if (/\.xlsx$/i.test(nomFichier)) return "xlsx";
  return "csv";
}

/**
 * Étape de LECTURE, isolée de la VALIDATION métier : elle ne fait que transformer des octets bruts
 * en lignes { en-tête → valeur }, sans connaître les règles produit (champ obligatoire, prix,
 * doublon…). Ces règles restent entièrement dans la boucle d'import de la route, inchangée quel
 * que soit le format d'origine du fichier.
 *
 * Garde-fou XLSX : `xlsx` (SheetJS) n'a pas de version corrigée publiée sur npm au-delà de 0.18.5
 * pour la pollution de prototype (CVE-2023-30533) et le ReDoS (CVE-2024-22363), toutes deux
 * déclenchées par le CONTENU d'un fichier lu — exactement notre cas, un classeur fourni par
 * l'utilisateur. Sans changer de librairie, on réduit ce qu'on lui laisse faire sur un fichier
 * hostile : `sheetRows` borne le nombre de lignes réellement parsées (au lieu de tout charger en
 * mémoire puis compter après coup), et on désactive les chemins de parsing jamais utilisés par
 * `sheet_to_json` (formules, HTML riche, macros VBA), qui réduisent d'autant le code SheetJS
 * exécuté sur un contenu non fiable.
 */
export function lireLignes(
  format: "xlsx" | "csv",
  buffer: Buffer,
  maxLignes?: number,
): Record<string, unknown>[] {
  if (format === "xlsx") {
    const classeur = XLSX.read(buffer, {
      type: "buffer",
      cellFormula: false,
      cellHTML: false,
      bookVBA: false,
      ...(maxLignes ? { sheetRows: maxLignes } : {}),
    });
    const nomPremiereFeuille = classeur.SheetNames[0];
    if (!nomPremiereFeuille) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(classeur.Sheets[nomPremiereFeuille]);
  }
  const texte = buffer.toString("utf-8");
  const { data } = Papa.parse<Record<string, unknown>>(texte, { header: true, skipEmptyLines: true });
  return data;
}

/** Lignes vides ignorées : au moins une cellule non vide, sinon la ligne n'existe pas vraiment. */
export function ligneExploitable(row: Record<string, unknown>): boolean {
  return Object.values(row).some((v) => v !== undefined && v !== null && String(v).trim() !== "");
}

export function pickField(row: Record<string, unknown>, field: keyof typeof CSV_FIELD_ALIASES): string | undefined {
  const aliases = CSV_FIELD_ALIASES[field];
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeader(key);
    if (aliases.includes(normalized)) {
      const value = row[key];
      if (value === null || value === undefined) return undefined;
      const str = String(value).trim();
      return str.length > 0 ? str : undefined;
    }
  }
  return undefined;
}

export function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? fallback : n;
}
