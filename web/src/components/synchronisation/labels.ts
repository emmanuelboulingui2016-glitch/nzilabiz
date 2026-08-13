// Libellés français pour les entités/actions journalisées dans SyncLog (§11).

const ENTITE_LABELS: Record<string, string> = {
  sale: "Vente",
  expense: "Dépense",
  stock_movement: "Mouvement de stock",
  cash_count: "Caisse",
  client: "Client",
  product: "Produit",
};

const ACTION_LABELS: Record<string, string> = {
  create: "création",
  update: "modification",
  delete: "suppression",
};

export function entiteLabel(entite: string): string {
  return ENTITE_LABELS[entite] ?? entite;
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function attributionLabel(userNom: string | null, deviceNom: string | null): string {
  const parts: string[] = [];
  if (userNom) parts.push(`par ${userNom}`);
  if (deviceNom) parts.push(deviceNom);
  return parts.length > 0 ? parts.join(" · ") : "Origine inconnue";
}
