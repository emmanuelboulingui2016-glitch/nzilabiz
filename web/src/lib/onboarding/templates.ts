// Modèles de catalogue de démarrage — §4 Amélioration "onboarding accéléré".
// La pharmacie est explicitement hors périmètre (voir cahier des charges §20) : ne pas ajouter ce modèle.

export type CatalogTemplateProduct = {
  nom: string;
  categorie: string;
  prixAchat: number;
  prixVente: number;
  unite: string;
};

export type CatalogTemplate = {
  id: string;
  label: string;
  description: string;
  products: CatalogTemplateProduct[];
};

export const CATALOG_TEMPLATES: CatalogTemplate[] = [
  {
    id: "epicerie",
    label: "Épicerie / alimentation générale",
    description: "Riz, huile, boissons, conserves, produits de première nécessité.",
    products: [
      { nom: "Riz (sac 25kg)", categorie: "Céréales", prixAchat: 15000, prixVente: 18000, unite: "sac" },
      { nom: "Huile végétale 1L", categorie: "Huiles", prixAchat: 1200, prixVente: 1500, unite: "unité" },
      { nom: "Sucre en poudre 1kg", categorie: "Épicerie", prixAchat: 800, prixVente: 1000, unite: "unité" },
      { nom: "Eau minérale 1.5L", categorie: "Boissons", prixAchat: 350, prixVente: 500, unite: "unité" },
      { nom: "Boîte de tomate concentrée", categorie: "Conserves", prixAchat: 400, prixVente: 600, unite: "unité" },
      { nom: "Savon de ménage", categorie: "Hygiène", prixAchat: 300, prixVente: 500, unite: "unité" },
    ],
  },
  {
    id: "quincaillerie",
    label: "Quincaillerie",
    description: "Outillage, peinture, matériel électrique de base.",
    products: [
      { nom: "Marteau", categorie: "Outillage", prixAchat: 2500, prixVente: 3500, unite: "unité" },
      { nom: "Peinture 1L", categorie: "Peinture", prixAchat: 3000, prixVente: 4500, unite: "unité" },
      { nom: "Câble électrique (rouleau)", categorie: "Électricité", prixAchat: 8000, prixVente: 11000, unite: "rouleau" },
      { nom: "Ampoule LED", categorie: "Électricité", prixAchat: 700, prixVente: 1200, unite: "unité" },
      { nom: "Boîte de clous", categorie: "Quincaillerie", prixAchat: 1000, prixVente: 1500, unite: "boîte" },
    ],
  },
  {
    id: "vetements",
    label: "Boutique de vêtements",
    description: "Prêt-à-porter homme, femme, enfant.",
    products: [
      { nom: "T-shirt", categorie: "Homme", prixAchat: 2500, prixVente: 5000, unite: "unité" },
      { nom: "Robe", categorie: "Femme", prixAchat: 6000, prixVente: 12000, unite: "unité" },
      { nom: "Pantalon", categorie: "Homme", prixAchat: 5000, prixVente: 9000, unite: "unité" },
      { nom: "Ensemble enfant", categorie: "Enfant", prixAchat: 3000, prixVente: 6000, unite: "unité" },
    ],
  },
  {
    id: "cosmetiques",
    label: "Cosmétiques / parfumerie",
    description: "Soins, parfums, produits de beauté.",
    products: [
      { nom: "Crème hydratante", categorie: "Soins", prixAchat: 2000, prixVente: 3500, unite: "unité" },
      { nom: "Parfum 50ml", categorie: "Parfumerie", prixAchat: 5000, prixVente: 9000, unite: "unité" },
      { nom: "Savon de beauté", categorie: "Hygiène", prixAchat: 500, prixVente: 900, unite: "unité" },
      { nom: "Huile capillaire", categorie: "Cheveux", prixAchat: 1500, prixVente: 2500, unite: "unité" },
    ],
  },
  {
    id: "telephonie",
    label: "Accessoires téléphone",
    description: "Coques, chargeurs, écouteurs, cartes SIM/recharge.",
    products: [
      { nom: "Coque de protection", categorie: "Accessoires", prixAchat: 1000, prixVente: 2500, unite: "unité" },
      { nom: "Chargeur USB-C", categorie: "Accessoires", prixAchat: 2000, prixVente: 4000, unite: "unité" },
      { nom: "Écouteurs filaires", categorie: "Accessoires", prixAchat: 1500, prixVente: 3000, unite: "unité" },
      { nom: "Carte mémoire 32Go", categorie: "Accessoires", prixAchat: 3500, prixVente: 6000, unite: "unité" },
    ],
  },
];
