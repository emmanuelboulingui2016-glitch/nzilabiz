// Clientèle de démonstration du module Clients.
//
// Isolé du seed principal pour deux raisons : le fichier reste lisible, et cette fonction peut
// être rejouée seule sur une boutique existante (`tsx src/db/seed-clientele.ts <storeId>`) sans
// recréer toute la base de démo.
//
// Les achats sont datés en jours avant aujourd'hui, de façon à couvrir chaque segment de
// fidélité (fidèle, récurrent, nouveau, occasionnel, inactif, sans achat) quelle que soit la
// date à laquelle le seed est exécuté.

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

type AchatDemo = {
  joursAvant: number;
  mode: "ESPECES" | "MOBILE_MONEY" | "CREDIT";
  lignes: { produitIndex: number; quantite: number }[];
};

type ClientDemo = {
  nom: string;
  telephone: string;
  adresse?: string;
  notes?: string;
  limiteCredit?: string;
  echeanceJours?: number;
  achats: AchatDemo[];
};

// Les index de produits pointent dans la liste des produits de la boutique, triés par création
// (riz, huile, sucre, savon, eau… dans le seed de démo). Le modulo à l'insertion évite toute
// erreur si la boutique a moins de produits que prévu.
const CLIENTS_DEMO: ClientDemo[] = [
  {
    nom: "Mama Ngoua",
    telephone: "077112233",
    adresse: "Nzeng-Ayong, derrière le marché",
    notes: "Revend au détail. Passe presque toutes les semaines, toujours le samedi matin.",
    achats: [
      { joursAvant: 3, mode: "ESPECES", lignes: [{ produitIndex: 0, quantite: 2 }, { produitIndex: 4, quantite: 6 }] },
      { joursAvant: 11, mode: "MOBILE_MONEY", lignes: [{ produitIndex: 0, quantite: 1 }, { produitIndex: 1, quantite: 3 }] },
      { joursAvant: 19, mode: "ESPECES", lignes: [{ produitIndex: 2, quantite: 4 }] },
      { joursAvant: 27, mode: "ESPECES", lignes: [{ produitIndex: 0, quantite: 2 }] },
      { joursAvant: 38, mode: "MOBILE_MONEY", lignes: [{ produitIndex: 3, quantite: 5 }, { produitIndex: 4, quantite: 12 }] },
      { joursAvant: 52, mode: "ESPECES", lignes: [{ produitIndex: 0, quantite: 1 }] },
      { joursAvant: 71, mode: "ESPECES", lignes: [{ produitIndex: 1, quantite: 2 }] },
      { joursAvant: 96, mode: "ESPECES", lignes: [{ produitIndex: 2, quantite: 3 }] },
    ],
  },
  {
    nom: "Papa Obame",
    telephone: "066445566",
    adresse: "Akébé",
    notes: "Achète pour son maquis. Demande souvent le prix de gros.",
    limiteCredit: "75000",
    echeanceJours: 21,
    achats: [
      { joursAvant: 12, mode: "CREDIT", lignes: [{ produitIndex: 0, quantite: 3 }] },
      { joursAvant: 24, mode: "ESPECES", lignes: [{ produitIndex: 1, quantite: 4 }, { produitIndex: 2, quantite: 2 }] },
      { joursAvant: 33, mode: "MOBILE_MONEY", lignes: [{ produitIndex: 4, quantite: 24 }] },
      { joursAvant: 45, mode: "ESPECES", lignes: [{ produitIndex: 0, quantite: 2 }] },
      { joursAvant: 58, mode: "ESPECES", lignes: [{ produitIndex: 3, quantite: 6 }] },
      { joursAvant: 80, mode: "ESPECES", lignes: [{ produitIndex: 1, quantite: 2 }] },
    ],
  },
  {
    nom: "Restaurant Chez Nadège",
    telephone: "074998877",
    adresse: "Louis, face à la station",
    notes: "Commande en gros en début de mois.",
    limiteCredit: "120000",
    echeanceJours: 30,
    achats: [
      { joursAvant: 25, mode: "MOBILE_MONEY", lignes: [{ produitIndex: 0, quantite: 4 }, { produitIndex: 1, quantite: 6 }] },
      { joursAvant: 56, mode: "ESPECES", lignes: [{ produitIndex: 0, quantite: 3 }] },
      { joursAvant: 88, mode: "ESPECES", lignes: [{ produitIndex: 2, quantite: 5 }] },
    ],
  },
  {
    nom: "Aline Moussavou",
    telephone: "062334455",
    adresse: "PK8",
    notes: "Nouvelle cliente, venue sur recommandation de Mama Ngoua.",
    achats: [{ joursAvant: 5, mode: "ESPECES", lignes: [{ produitIndex: 4, quantite: 6 }, { produitIndex: 3, quantite: 2 }] }],
  },
  {
    nom: "Sylvie Mabiala",
    telephone: "065221144",
    adresse: "Owendo",
    achats: [{ joursAvant: 47, mode: "ESPECES", lignes: [{ produitIndex: 2, quantite: 2 }] }],
  },
  {
    nom: "Jean-Pierre Ndong",
    telephone: "077665544",
    adresse: "Charbonnages",
    notes: "Ne vient plus depuis qu'il a déménagé — à relancer.",
    achats: [
      { joursAvant: 142, mode: "ESPECES", lignes: [{ produitIndex: 0, quantite: 1 }] },
      { joursAvant: 165, mode: "ESPECES", lignes: [{ produitIndex: 1, quantite: 3 }] },
      { joursAvant: 190, mode: "ESPECES", lignes: [{ produitIndex: 4, quantite: 10 }] },
      { joursAvant: 214, mode: "MOBILE_MONEY", lignes: [{ produitIndex: 3, quantite: 4 }] },
    ],
  },
  {
    nom: "Boutique Mariam",
    telephone: "066778899",
    adresse: "Marché de Mont-Bouët",
    notes: "Fiche créée après un passage, n'a encore rien acheté.",
    achats: [],
  },
];

function joursAvant(jours: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  d.setHours(9 + (jours % 8), (jours * 7) % 60, 0, 0);
  return d;
}

export async function seedClientele(
  db: Db,
  { storeId, userId, deviceId }: { storeId: string; userId: string; deviceId?: string | null }
) {
  const produits = await db.query.products.findMany({
    where: eq(schema.products.storeId, storeId),
    orderBy: (p, { asc }) => [asc(p.creeLe)],
  });
  if (produits.length === 0) throw new Error("Aucun produit dans cette boutique : seedez les produits d'abord.");

  // Reprend la numérotation là où la boutique s'est arrêtée (V-0001 créé par le seed principal).
  const [{ nb }] = await db
    .select({ nb: sql<number>`count(*)::int` })
    .from(schema.sales)
    .where(eq(schema.sales.storeId, storeId));
  let numeroSeq = (nb ?? 0) + 1;

  let nbVentes = 0;

  for (const demo of CLIENTS_DEMO) {
    const [client] = await db
      .insert(schema.clients)
      .values({
        storeId,
        nom: demo.nom,
        telephone: demo.telephone,
        adresse: demo.adresse ?? null,
        notes: demo.notes ?? null,
        limiteCredit: demo.limiteCredit ?? null,
        echeanceJours: demo.echeanceJours ?? null,
      })
      .returning();

    for (const achat of demo.achats) {
      const lignes = achat.lignes.map((l) => {
        const produit = produits[l.produitIndex % produits.length];
        const prixUnitaire = Number(produit.prixVente);
        return {
          produit,
          quantite: l.quantite,
          prixUnitaire,
          sousTotal: prixUnitaire * l.quantite,
        };
      });
      const total = lignes.reduce((sum, l) => sum + l.sousTotal, 0);
      const dateHeure = joursAvant(achat.joursAvant);

      const [sale] = await db
        .insert(schema.sales)
        .values({
          storeId,
          numero: `V-${String(numeroSeq++).padStart(4, "0")}`,
          dateHeure,
          userId,
          deviceId: deviceId ?? null,
          clientId: client.id,
          sousTotal: String(total),
          remise: "0",
          total: String(total),
          statut: "VALIDEE",
          creeLe: dateHeure,
        })
        .returning();

      await db.insert(schema.saleItems).values(
        lignes.map((l) => ({
          saleId: sale.id,
          productId: l.produit.id,
          quantite: String(l.quantite),
          prixUnitaire: String(l.prixUnitaire),
          prixAchatUnitaire: String(Number(l.produit.prixAchat)),
          sousTotal: String(l.sousTotal),
        }))
      );

      // La table payments ne porte pas de date : celle de la vente fait foi.
      await db.insert(schema.payments).values({
        saleId: sale.id,
        mode: achat.mode,
        montant: String(total),
      });

      await db.insert(schema.stockMovements).values(
        lignes.map((l) => ({
          productId: l.produit.id,
          type: "VENTE" as const,
          quantite: String(-l.quantite),
          userId,
          saleId: sale.id,
          date: dateHeure,
        }))
      );

      nbVentes++;
    }
  }

  return { nbClients: CLIENTS_DEMO.length, nbVentes };
}

// Exécution autonome : tsx src/db/seed-clientele.ts [storeId]
// Sans argument, cible la première boutique trouvée (la boutique de démo).
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("src/db/seed-clientele.ts")) {
  const run = async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    await import("dotenv/config");

    const connectionString =
      process.env.DATABASE_URL || "postgresql://nzilabiz:nzilabiz_dev_password@localhost:5432/nzilabiz";
    const pgClient = postgres(connectionString, { max: 1 });
    const db = drizzle(pgClient, { schema });

    const storeId = process.argv[2] ?? (await db.query.stores.findFirst())?.id;
    if (!storeId) throw new Error("Aucune boutique trouvée.");
    const user = await db.query.users.findFirst({ where: eq(schema.users.storeId, storeId) });
    if (!user) throw new Error("Aucun utilisateur dans cette boutique.");
    const device = await db.query.devices.findFirst({ where: eq(schema.devices.storeId, storeId) });

    const { nbClients, nbVentes } = await seedClientele(db, {
      storeId,
      userId: user.id,
      deviceId: device?.id ?? null,
    });
    console.log(`Clientèle de démonstration : ${nbClients} clients, ${nbVentes} ventes.`);
    await pgClient.end();
    process.exit(0);
  };
  run().catch((err) => {
    console.error("Échec du seed clientèle :", err);
    process.exit(1);
  });
}
