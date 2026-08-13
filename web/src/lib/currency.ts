// Formatage FCFA — §2 du cahier des charges : séparateur de milliers par espace, aucune décimale.
// ex. formatFcfa(292500) => "292 500 FCFA"

export function formatFcfa(amount: number | string, devise = "FCFA"): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return `0 ${devise}`;
  const rounded = Math.round(n);
  const formatted = rounded.toLocaleString("fr-FR").replace(/ | /g, " ");
  return `${formatted} ${devise}`;
}

export function parseFcfaInput(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isNaN(n) ? 0 : n;
}
