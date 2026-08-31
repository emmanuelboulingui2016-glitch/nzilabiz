// Jeu de données de démonstration — npm run db:seed
// Crée une boutique, un patron, un gérant, un vendeur, quelques produits, une vente et un client à crédit.
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import bcrypt from "bcryptjs";
import { genProductRef } from "../lib/utils";
import { seedClientele } from "./seed-clientele";
import { connectionStringRequise } from "./connection-string";
import { refuserSiBaseDistante } from "./garde-base";
import { randomBytes } from "node:crypto";

async function main() {
  const connectionString = connectionStringRequise("le jeu de démonstration");
  refuserSiBaseDistante(connectionString, "db:seed");
  const pgClient = postgres(connectionString, { max: 1 });
  const db = drizzle(pgClient, { schema });

  console.log("Seed : création de la boutique de démonstration…");

  const [store] = await db
    .insert(schema.stores)
    .values({
      nom: "Boutique Démo NzilaBiz",
      ville: "Libreville",
      quartier: "Nzeng-Ayong",
      typeCommerce: "Épicerie",
      plan: "PREMIUM",
    })
    .returning();

  await db.insert(schema.notificationSettings).values({ storeId: store.id });

  // Mot de passe tiré au hasard à chaque exécution, et affiché une seule fois en fin de script.
  // La version précédente le codait en dur : trois comptes, dont un PATRON, avec un mot de passe
  // que connaissait quiconque avait lu le dépôt. Un jeu de démonstration reste une base réelle avec
  // de vrais comptes ; il n'y a aucune raison que son mot de passe soit devinable.
  const motDePasseDemo = process.env.MOT_DE_PASSE_DEMO?.trim() || randomBytes(9).toString("base64url");
  const passwordHash = await bcrypt.hash(motDePasseDemo, 10);

  const [patron] = await db
    .insert(schema.users)
    .values({ storeId: store.id, nom: "Emmanuel (Patron)", email: "patron@nzilabiz.demo", motDePasseHash: passwordHash, role: "PATRON" })
    .returning();

  const [gerant] = await db
    .insert(schema.users)
    .values({ storeId: store.id, nom: "Fatou (Gérante)", email: "gerant@nzilabiz.demo", motDePasseHash: passwordHash, role: "GERANT" })
    .returning();

  const [vendeur] = await db
    .insert(schema.users)
    .values({ storeId: store.id, nom: "Junior (Vendeur)", email: "vendeur@nzilabiz.demo", motDePasseHash: passwordHash, role: "VENDEUR" })
    .returning();

  const [device] = await db
    .insert(schema.devices)
    .values({ storeId: store.id, userId: patron.id, nom: "Téléphone caisse 1" })
    .returning();

  const [catEpicerie] = await db.insert(schema.categories).values({ storeId: store.id, nom: "Épicerie" }).returning();
  const [catBoissons] = await db.insert(schema.categories).values({ storeId: store.id, nom: "Boissons" }).returning();

  const productsData = [
    { nom: "Riz (sac 25kg)", categoryId: catEpicerie.id, prixAchat: "15000", prixVente: "18000", quantiteStock: "20" },
    { nom: "Huile végétale 1L", categoryId: catEpicerie.id, prixAchat: "1200", prixVente: "1500", quantiteStock: "40" },
    { nom: "Sucre en poudre 1kg", categoryId: catEpicerie.id, prixAchat: "800", prixVente: "1000", quantiteStock: "3" },
    { nom: "Eau minérale 1.5L", categoryId: catBoissons.id, prixAchat: "350", prixVente: "500", quantiteStock: "60" },
  ];

  const insertedProducts = [];
  for (const p of productsData) {
    const [row] = await db
      .insert(schema.products)
      .values({ storeId: store.id, reference: genProductRef(), unite: "unité", seuilAlerte: "5", ...p })
      .returning();
    insertedProducts.push(row);
  }

  const [demoClient] = await db
    .insert(schema.clients)
    .values({ storeId: store.id, nom: "Client Fidèle SARL", telephone: "+24107000000", limiteCredit: "50000", echeanceJours: 15 })
    .returning();

  const [sale] = await db
    .insert(schema.sales)
    .values({
      storeId: store.id,
      numero: "V-0001",
      userId: patron.id,
      deviceId: device.id,
      clientId: demoClient.id,
      sousTotal: "18000",
      remise: "0",
      total: "18000",
      statut: "VALIDEE",
    })
    .returning();

  await db.insert(schema.saleItems).values({
    saleId: sale.id,
    productId: insertedProducts[0].id,
    quantite: "1",
    prixUnitaire: "18000",
    prixAchatUnitaire: "15000",
    sousTotal: "18000",
  });

  await db.insert(schema.payments).values({ saleId: sale.id, mode: "CREDIT", montant: "18000" });

  await db.insert(schema.stockMovements).values({
    productId: insertedProducts[0].id,
    type: "VENTE",
    quantite: "-1",
    userId: patron.id,
    saleId: sale.id,
  });

  // Clientèle de démonstration du module Clients : plusieurs profils d'achat pour que les
  // segments de fidélité (fidèle, récurrent, inactif…) soient visibles dès la première connexion.
  const { nbClients, nbVentes } = await seedClientele(db, {
    storeId: store.id,
    userId: patron.id,
    deviceId: device.id,
  });
  console.log(`Clientèle de démonstration : ${nbClients} clients, ${nbVentes} ventes.`);

  console.log("Seed terminé.");
  console.log(`Comptes de démonstration (mot de passe : ${motDePasseDemo}) :`);
  console.log(`  Patron  : ${patron.email}`);
  console.log(`  Gérant  : ${gerant.email}`);
  console.log(`  Vendeur : ${vendeur.email}`);

  await pgClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Échec du seed :", err);
  process.exit(1);
});
