/**
 * Remise à zéro complète de la base, puis création du compte administrateur et d'une boutique de
 * démonstration prête à présenter.
 *
 *   npm run db:reset-demo          base locale (web/.env)
 *   npm run db:reset-demo:prod     base en ligne (web/.env.deploy)
 *
 * ⚠️ Destructif : toutes les boutiques, tous les comptes et toutes leurs données sont effacés.
 * Une sauvegarde complète est écrite dans sauvegardes/ avant la moindre suppression.
 *
 * Le mot de passe du compte administrateur est tiré au hasard et écrit dans
 * sauvegardes/compte-administrateur.txt : il n'apparaît ni à l'écran, ni dans l'historique du
 * terminal. À changer à la première connexion.
 */

import dotenv from "dotenv";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as s from "./schema";

const fichierEnv = process.argv.find((a) => a.startsWith("--env="))?.slice(6) ?? ".env";
dotenv.config({ path: fichierEnv });

const ADMIN_EMAIL = "nzilabiz@gmail.com";
const ADMIN_NOM = "Administration NzilaBiz";
const BOUTIQUE_DEMO = "Boutique Démonstration";

/** Ordre inverse des dépendances : les feuilles avant les racines. */
const TABLES_A_VIDER = [
  "rate_limits", "sync_logs", "notifications", "notification_settings", "mobile_money_settings",
  "support_tickets", "invitations", "approval_requests", "cash_counts", "debt_repayments",
  "payments", "sale_items", "documents", "stock_movements", "stock_receipt_items",
  "stock_receipts", "expenses", "sales", "products", "categories", "clients", "devices",
  "users", "stores",
];

const jours = (n: number) => new Date(Date.now() - n * 86_400_000);
const a = (d: Date, h: number, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};
const fcfa = (n: number) => n.toFixed(2);

/** Générateur pseudo-aléatoire à graine : deux exécutions produisent la même démonstration. */
let graine = 20260819;
const alea = () => {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
};
const entre = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
const parmi = <T,>(liste: readonly T[]): T => liste[entre(0, liste.length - 1)];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL absent de ${fichierEnv}.`);
  console.log(`Cible : ${url.replace(/^.*@/, "").replace(/\?.*$/, "")}`);

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema: s });

  // ------------------------------------------------------------------ sauvegarde
  const avant: Record<string, unknown[]> = {};
  for (const t of TABLES_A_VIDER) avant[t] = await client.unsafe(`select * from ${t}`);
  const lignes = Object.values(avant).reduce((n, l) => n + l.length, 0);
  fs.mkdirSync("sauvegardes", { recursive: true });
  fs.writeFileSync("sauvegardes/avant-remise-a-zero.json", JSON.stringify(avant, null, 2));
  console.log(`Sauvegarde : ${lignes} lignes conservées dans sauvegardes/avant-remise-a-zero.json`);

  // ------------------------------------------------------------------ remise à zéro
  await client.unsafe(`truncate ${TABLES_A_VIDER.join(", ")} cascade`);
  console.log(`Base vidée : ${TABLES_A_VIDER.length} tables.`);

  // ------------------------------------------------------------------ comptes
  // Un mot de passe par compte, et non un seul partagé. La version précédente réutilisait le même
  // haché pour l'administrateur, la gérante et le vendeur : connaître celui du vendeur de
  // démonstration, c'était connaître celui de l'administrateur de toute la plateforme.
  const nouveauMotDePasse = () => randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "") + "9!";
  const motDePasse = nouveauMotDePasse();
  const motDePasseGerante = nouveauMotDePasse();
  const motDePasseVendeur = nouveauMotDePasse();
  const hash = await bcrypt.hash(motDePasse, 10);
  const hashGerante = await bcrypt.hash(motDePasseGerante, 10);
  const hashVendeur = await bcrypt.hash(motDePasseVendeur, 10);
  const finPeriodeTest = new Date(Date.now() + 30 * 86_400_000);

  const [boutique] = await db
    .insert(s.stores)
    .values({
      nom: BOUTIQUE_DEMO,
      telephone: "+241 77 00 00 00",
      adresse: "Avenue de Cointet",
      ville: "Libreville",
      quartier: "Nombakélé",
      pays: "Gabon",
      typeCommerce: "Alimentation générale",
      plan: "ENTREPRISE",
      essaiExpireLe: finPeriodeTest,
      noteBasFacture: "Merci de votre confiance — NzilaBiz",
      creeLe: jours(75),
    })
    .returning();

  const [admin] = await db
    .insert(s.users)
    .values({
      storeId: boutique.id,
      nom: ADMIN_NOM,
      email: ADMIN_EMAIL,
      motDePasseHash: hash,
      role: "PATRON",
      creeLe: jours(75),
      derniereConnexion: jours(0),
    })
    .returning();

  const [gerante] = await db
    .insert(s.users)
    .values({
      storeId: boutique.id,
      nom: "Sylvie NDONG",
      email: "gerante.demo@nzilabiz.store",
      motDePasseHash: hashGerante,
      role: "GERANT",
      creeLe: jours(60),
      derniereConnexion: jours(1),
    })
    .returning();

  const [vendeur] = await db
    .insert(s.users)
    .values({
      storeId: boutique.id,
      nom: "Patrick OYANE",
      email: "vendeur.demo@nzilabiz.store",
      motDePasseHash: hashVendeur,
      role: "VENDEUR",
      creeLe: jours(45),
      derniereConnexion: jours(2),
    })
    .returning();

  const equipe = [admin, gerante, vendeur];

  const appareils = await db
    .insert(s.devices)
    .values([
      { storeId: boutique.id, userId: admin.id, nom: "Ordinateur de la boutique", derniereActivite: jours(0) },
      { storeId: boutique.id, userId: gerante.id, nom: "Téléphone Android", derniereActivite: jours(1) },
      { storeId: boutique.id, userId: vendeur.id, nom: "Tablette caisse", derniereActivite: jours(2) },
    ])
    .returning();

  await db.insert(s.notificationSettings).values({ storeId: boutique.id });

  // ------------------------------------------------------------------ catalogue
  const cats = await db
    .insert(s.categories)
    .values(["Boissons", "Alimentaire", "Hygiène", "Entretien"].map((nom) => ({ storeId: boutique.id, nom })))
    .returning();
  const cat = (n: string) => cats.find((c) => c.nom === n)!.id;

  // référence, nom, catégorie, prix achat, prix vente, prix gros, unité, stock, seuil
  const catalogue: readonly (readonly [string, string, string, number, number, number, string, number, number])[] = [
    ["BOI-001", "Coca-Cola 33cl", "Boissons", 350, 500, 450, "canette", 120, 24],
    ["BOI-002", "Eau minérale 1,5L", "Boissons", 300, 500, 450, "bouteille", 84, 24],
    ["BOI-003", "Jus d'ananas 1L", "Boissons", 900, 1400, 1250, "bouteille", 31, 12],
    ["BOI-004", "Bière Régab 65cl", "Boissons", 700, 1000, 900, "bouteille", 96, 24],
    ["ALI-001", "Riz parfumé 5kg", "Alimentaire", 3800, 5000, 4600, "sac", 42, 10],
    ["ALI-002", "Huile végétale 1L", "Alimentaire", 1200, 1750, 1600, "bouteille", 58, 12],
    ["ALI-003", "Sucre en poudre 1kg", "Alimentaire", 700, 1000, 900, "paquet", 8, 15],
    ["ALI-004", "Lait concentré 397g", "Alimentaire", 750, 1100, 1000, "boîte", 64, 12],
    ["ALI-005", "Sardines à l'huile", "Alimentaire", 500, 800, 700, "boîte", 3, 20],
    ["ALI-006", "Pâtes spaghetti 500g", "Alimentaire", 450, 700, 600, "paquet", 77, 15],
    ["HYG-001", "Savon de Marseille", "Hygiène", 250, 400, 350, "pièce", 140, 30],
    ["HYG-002", "Dentifrice 75ml", "Hygiène", 800, 1250, 1100, "tube", 36, 12],
    ["HYG-003", "Papier hygiénique x4", "Hygiène", 900, 1400, 1250, "paquet", 27, 10],
    ["ENT-001", "Eau de javel 1L", "Entretien", 450, 750, 650, "bouteille", 45, 12],
    ["ENT-002", "Détergent lessive 1kg", "Entretien", 1400, 2000, 1850, "paquet", 22, 10],
    ["ENT-003", "Éponge à récurer x3", "Entretien", 300, 550, 480, "lot", 0, 10],
  ];

  const produits = await db
    .insert(s.products)
    .values(
      catalogue.map(([reference, nom, categorie, achat, vente, gros, unite, stock, seuil]) => ({
        storeId: boutique.id,
        reference,
        nom,
        categoryId: cat(categorie),
        prixAchat: fcfa(achat),
        prixVente: fcfa(vente),
        prixGros: fcfa(gros),
        unite,
        quantiteStock: fcfa(stock),
        seuilAlerte: fcfa(seuil),
        creeLe: jours(75),
      })),
    )
    .returning();

  // ------------------------------------------------------------------ clientèle
  const clientsDemo: readonly (readonly [string, string, number | null, number | null, string | null, number])[] = [
    ["Mme ABESSOLO Clarisse", "+241 66 12 34 56", 50000, 30, "Revend au marché de Mont-Bouët. Passe tous les lundis.", 70],
    ["M. MBA Jean-Pierre", "+241 74 55 21 09", 30000, 15, "Tenancier de bar, achète les boissons en gros.", 68],
    ["Restaurant Le Palmier", "+241 62 88 44 12", 100000, 30, "Facture mensuelle, règlement par Mobile Money.", 65],
    ["Mme NZE Bernadette", "+241 66 90 12 33", 20000, 15, "Petite revendeuse de quartier.", 55],
    ["M. OBAME Serge", "+241 77 41 22 88", null, null, "Client de passage, paie toujours comptant.", 40],
    ["Épicerie du Carrefour", "+241 65 33 77 21", 75000, 30, "Achète nos surplus en gros.", 30],
    ["Mme MOUSSAVOU Alice", "+241 66 74 09 55", 25000, 15, null, 20],
    ["M. ONDO Firmin", "+241 74 12 88 40", null, null, "Achète surtout de l'entretien.", 8],
  ];

  const clients = await db
    .insert(s.clients)
    .values(
      clientsDemo.map(([nom, telephone, limite, echeance, notes, age]) => ({
        storeId: boutique.id,
        nom,
        telephone,
        limiteCredit: limite === null ? null : fcfa(limite),
        echeanceJours: echeance,
        notes,
        creeLe: jours(age),
      })),
    )
    .returning();

  // ------------------------------------------------------------------ ventes sur 75 jours
  //
  // Un historique creux ne montre rien : ni tendance dans les rapports, ni segmentation de
  // fidélité, ni créance en retard. On répartit donc les ventes sur toute la période, avec des
  // clients réguliers, des clients occasionnels, et quelques crédits volontairement anciens.
  type Ligne = { produit: (typeof produits)[number]; quantite: number };

  const numeroDuJour = new Map<string, number>();
  let totalVentes = 0;
  let totalCredits = 0;
  const ventesACredit: { saleId: string; clientId: string; total: number; date: Date }[] = [];

  for (let j = 75; j >= 0; j--) {
    const date = jours(j);
    const dimanche = date.getDay() === 0;
    const nbVentes = dimanche ? entre(1, 3) : entre(3, 8);

    for (let v = 0; v < nbVentes; v++) {
      const quand = a(date, entre(8, 19), entre(0, 59));
      const cle = `${quand.getFullYear()}${String(quand.getMonth() + 1).padStart(2, "0")}${String(quand.getDate()).padStart(2, "0")}`;
      const rang = (numeroDuJour.get(cle) ?? 0) + 1;
      numeroDuJour.set(cle, rang);

      const lignes: Ligne[] = [];
      const nbLignes = entre(1, 4);
      for (let l = 0; l < nbLignes; l++) {
        const produit = parmi(produits);
        if (lignes.some((x) => x.produit.id === produit.id)) continue;
        lignes.push({ produit, quantite: entre(1, 6) });
      }
      if (lignes.length === 0) continue;

      const sousTotal = lignes.reduce((t, x) => t + Number(x.produit.prixVente) * x.quantite, 0);
      const remise = alea() < 0.12 ? Math.round((sousTotal * entre(3, 8)) / 100) : 0;
      const total = sousTotal - remise;

      // Un client sur trois est identifié ; le crédit ne concerne que ceux qui ont une limite.
      const clientLie = alea() < 0.45 ? parmi(clients) : null;
      const peutCredit = clientLie !== null && clientLie.limiteCredit !== null;
      const mode = peutCredit && alea() < 0.3 ? "CREDIT" : alea() < 0.35 ? "MOBILE_MONEY" : "ESPECES";
      const auteur = parmi(equipe);

      const [vente] = await db
        .insert(s.sales)
        .values({
          storeId: boutique.id,
          numero: `V-${cle}-${String(rang).padStart(3, "0")}`,
          dateHeure: quand,
          userId: auteur.id,
          deviceId: parmi(appareils).id,
          clientId: clientLie?.id ?? null,
          sousTotal: fcfa(sousTotal),
          remise: fcfa(remise),
          typeRemise: "MONTANT" as const,
          total: fcfa(total),
          statut: "VALIDEE",
          creeLe: quand,
        })
        .returning();

      await db.insert(s.saleItems).values(
        lignes.map((x) => ({
          saleId: vente.id,
          productId: x.produit.id,
          quantite: fcfa(x.quantite),
          prixUnitaire: x.produit.prixVente,
          prixAchatUnitaire: x.produit.prixAchat,
          sousTotal: fcfa(Number(x.produit.prixVente) * x.quantite),
        })),
      );

      await db.insert(s.payments).values({
        saleId: vente.id,
        mode,
        montant: fcfa(total),
        montantRecu: mode === "ESPECES" ? fcfa(Math.ceil(total / 500) * 500) : null,
        monnaieRendue: mode === "ESPECES" ? fcfa(Math.ceil(total / 500) * 500 - total) : null,
        reference: mode === "MOBILE_MONEY" ? `MM${entre(100000, 999999)}` : null,
      });

      await db.insert(s.stockMovements).values(
        lignes.map((x) => ({
          productId: x.produit.id,
          type: "VENTE" as const,
          quantite: fcfa(-x.quantite),
          userId: auteur.id,
          saleId: vente.id,
          date: quand,
        })),
      );

      totalVentes++;
      if (mode === "CREDIT" && clientLie) {
        totalCredits++;
        ventesACredit.push({ saleId: vente.id, clientId: clientLie.id, total, date: quand });
      }
    }
  }

  // Deux tiers des crédits sont remboursés : il doit rester des créances en cours, dont
  // certaines en retard, sinon l'écran Créances est vide et ne démontre rien.
  for (const credit of ventesACredit) {
    if (alea() < 0.65) {
      const partiel = alea() < 0.3;
      await db.insert(s.debtRepayments).values({
        clientId: credit.clientId,
        saleId: credit.saleId,
        montant: fcfa(partiel ? Math.round(credit.total / 2) : credit.total),
        mode: alea() < 0.5 ? "ESPECES" : "MOBILE_MONEY",
        date: new Date(credit.date.getTime() + entre(2, 20) * 86_400_000),
      });
    }
  }

  // ------------------------------------------------------------------ dépenses
  const depenses: readonly (readonly [string, string, number, number, boolean])[] = [
    ["Loyer", "Loyer du local commercial", 150000, 5, true],
    ["Électricité", "Facture SEEG", 42000, 12, false],
    ["Transport", "Carburant véhicule de livraison", 25000, 18, false],
    ["Salaires", "Salaire vendeur — mois écoulé", 130000, 30, true],
    ["Fournitures", "Rouleaux pour imprimante de tickets", 8000, 22, false],
    ["Électricité", "Facture SEEG", 38500, 42, false],
    ["Loyer", "Loyer du local commercial", 150000, 35, true],
    ["Transport", "Taxi approvisionnement marché", 12000, 48, false],
    ["Salaires", "Salaire vendeur — mois écoulé", 130000, 60, true],
    ["Entretien", "Réparation congélateur", 45000, 55, false],
  ];

  await db.insert(s.expenses).values(
    depenses.map(([categorie, description, montant, age, recurrente]) => ({
      storeId: boutique.id,
      userId: admin.id,
      categorie,
      description,
      montant: fcfa(montant),
      date: jours(age),
      modeReglement: (alea() < 0.5 ? "ESPECES" : "MOBILE_MONEY") as "ESPECES" | "MOBILE_MONEY",
      recurrente,
      frequence: recurrente ? ("MENSUELLE" as const) : null,
    })),
  );

  // ------------------------------------------------------------------ caisse
  const caisses: (typeof s.cashCounts.$inferInsert)[] = [];
  for (let j = 6; j >= 0; j--) {
    const date = jours(j);
    const theorique = entre(45000, 180000);
    const ecart = alea() < 0.25 ? entre(-2500, 2500) : 0;
    caisses.push(
      {
        storeId: boutique.id,
        userId: parmi(equipe).id,
        type: "OUVERTURE",
        montantSaisi: fcfa(20000),
        montantTheorique: fcfa(20000),
        ecart: fcfa(0),
        date: a(date, 8),
      },
      {
        storeId: boutique.id,
        userId: parmi(equipe).id,
        type: "FERMETURE",
        montantSaisi: fcfa(theorique + ecart),
        montantTheorique: fcfa(theorique),
        ecart: fcfa(ecart),
        date: a(date, 20),
      },
    );
  }
  await db.insert(s.cashCounts).values(caisses);

  // ------------------------------------------------------------------ documents
  const documents: (typeof s.documents.$inferInsert)[] = [
    {
      storeId: boutique.id,
      type: "PROFORMA",
      numero: "PRO-2026-0007",
      statut: "EMISE",
      clientId: clients[2].id,
      montantTotal: fcfa(87500),
      userId: admin.id,
      date: jours(4),
      itemsBrouillon: JSON.stringify([
        { nom: "Riz parfumé 5kg", quantite: 10, prixUnitaire: 5000 },
        { nom: "Huile végétale 1L", quantite: 15, prixUnitaire: 1750 },
        { nom: "Sucre en poudre 1kg", quantite: 12, prixUnitaire: 1000 },
      ]),
    },
    {
      storeId: boutique.id,
      type: "PROFORMA",
      numero: "PRO-2026-0008",
      statut: "BROUILLON",
      clientNomLibre: "Hôtel Le Cristal (prospect)",
      montantTotal: fcfa(214000),
      userId: gerante.id,
      date: jours(1),
      itemsBrouillon: JSON.stringify([
        { nom: "Eau minérale 1,5L", quantite: 240, prixUnitaire: 450 },
        { nom: "Coca-Cola 33cl", quantite: 240, prixUnitaire: 450 },
      ]),
    },
  ];
  await db.insert(s.documents).values(documents);

  // ------------------------------------------------------------------ activité annexe
  await db.insert(s.notifications).values([
    { storeId: boutique.id, type: "STOCK_BAS", message: "Sardines à l'huile : il reste 3 boîtes (seuil 20).", lue: false, creeLe: jours(0) },
    { storeId: boutique.id, type: "STOCK_BAS", message: "Éponge à récurer x3 : rupture de stock.", lue: false, creeLe: jours(0) },
    { storeId: boutique.id, type: "CREANCE", message: "Des créances arrivent à échéance cette semaine.", lue: true, creeLe: jours(3) },
  ]);

  await db.insert(s.syncLogs).values([
    { storeId: boutique.id, userId: vendeur.id, deviceId: appareils[2].id, entite: "sale", action: "CREATE", statut: "OK", horodatage: jours(1) },
    { storeId: boutique.id, userId: gerante.id, deviceId: appareils[1].id, entite: "product", action: "UPDATE", statut: "OK", horodatage: jours(2) },
    { storeId: boutique.id, userId: vendeur.id, deviceId: appareils[2].id, entite: "sale", action: "CREATE", statut: "ECHEC", message: "Réseau indisponible — rejouée automatiquement", horodatage: jours(2) },
  ]);

  // ------------------------------------------------------------------ réglages plateforme
  const codeTest = randomBytes(6).toString("hex").toUpperCase();
  await db.insert(s.platformSettings).values({
    nomApplication: "NzilaBiz",
    supportEmail: ADMIN_EMAIL,
    testLienCode: codeTest,
    testLienActif: true,
    testLienExpireLe: finPeriodeTest,
  });

  const stockBas = produits.filter((p) => Number(p.quantiteStock) <= Number(p.seuilAlerte)).length;
  console.log("");
  console.log(`Boutique      : ${BOUTIQUE_DEMO}`);
  console.log(`Comptes       : 3 (1 patron, 1 gérante, 1 vendeur)`);
  console.log(`Catalogue     : ${produits.length} produits, dont ${stockBas} sous le seuil d'alerte`);
  console.log(`Clientèle     : ${clients.length} clients`);
  console.log(`Ventes        : ${totalVentes} sur 75 jours, dont ${totalCredits} à crédit`);
  console.log(`Dépenses      : ${depenses.length}`);
  console.log(`Caisse        : ${caisses.length} comptages sur 7 jours`);
  console.log(`Documents     : ${documents.length} proformas`);
  console.log(`Fin de test   : ${finPeriodeTest.toLocaleDateString("fr-FR")}`);

  await client.end();

  fs.writeFileSync(
    "sauvegardes/compte-administrateur.txt",
    [
      "Compte administrateur NzilaBiz",
      "==============================",
      "",
      `Adresse      : ${ADMIN_EMAIL}`,
      `Mot de passe : ${motDePasse}`,
      "",
      "À changer dès la première connexion (Paramètres → Sécurité), puis supprimer ce fichier.",
      "",
      "Comptes employés de démonstration (chacun son mot de passe) :",
      `  ${gerante.email}   — Gérante — ${motDePasseGerante}`,
      `  ${vendeur.email}  — Vendeur — ${motDePasseVendeur}`,
      "",
      `Code du lien testeur : ${codeTest}`,
      `Valable jusqu'au ${finPeriodeTest.toLocaleDateString("fr-FR")}`,
      "",
      "Ce fichier est ignoré par git.",
    ].join("\n"),
  );
  console.log("");
  console.log("Identifiants et code testeur → sauvegardes/compte-administrateur.txt");
}

main().catch((e) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
