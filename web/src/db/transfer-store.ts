// Transfert du contenu d'une boutique vers une autre, puis suppression de la boutique source.
//
// Sert à récupérer un jeu de démonstration dans sa vraie boutique : on garde le catalogue, les
// ventes et l'historique, et on se débarrasse des comptes de démo.
//
// Deux points délicats traités ici :
//  1. Les lignes qui portent un `user_id` (ventes, dépenses, mouvements de stock…) pointent vers
//     des comptes de la boutique source, qui vont disparaître. Elles sont réattribuées au
//     destinataire AVANT la suppression, sinon la contrainte de clé étrangère bloque.
//  2. Les numéros de vente sont uniques par boutique. Si la cible a déjà des ventes, les numéros
//     transférés sont renumérotés à la suite pour éviter la collision.
//
// Usage : npx tsx src/db/transfer-store.ts "<boutique source>" "<boutique cible>"

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";
import { connectionStringRequise } from "./connection-string";
import { refuserSiBaseDistante } from "./garde-base";

async function main() {
  const [nomSource, nomCible] = process.argv.slice(2);
  if (!nomSource || !nomCible) {
    console.error('Usage : npx tsx src/db/transfer-store.ts "<boutique source>" "<boutique cible>"');
    process.exit(1);
  }

  const connectionString =
    connectionStringRequise("le transfert de boutique");
  refuserSiBaseDistante(connectionString, "transfer-store");
  const pg = postgres(connectionString, { max: 1 });
  const db = drizzle(pg, { schema });

  const source = await db.query.stores.findFirst({ where: eq(schema.stores.nom, nomSource) });
  const cible = await db.query.stores.findFirst({ where: eq(schema.stores.nom, nomCible) });
  if (!source) throw new Error(`Boutique source introuvable : ${nomSource}`);
  if (!cible) throw new Error(`Boutique cible introuvable : ${nomCible}`);
  if (source.id === cible.id) throw new Error("La source et la cible sont la même boutique.");

  // Destinataire des lignes portant un auteur : le Patron de la boutique cible.
  const patronCible = await db.query.users.findFirst({
    where: (u, { and, eq: eqq }) => and(eqq(u.storeId, cible.id), eqq(u.role, "PATRON")),
  });
  if (!patronCible) throw new Error("La boutique cible n'a pas de compte Patron.");

  console.log(`Transfert de « ${source.nom} » vers « ${cible.nom} » (auteur : ${patronCible.nom})…`);

  await pg.begin(async (tx) => {
    const decalage = await tx`
      select coalesce(count(*), 0)::int as nb from sales where store_id = ${cible.id}
    `;
    const ventesExistantes = decalage[0]?.nb ?? 0;

    // Renumérotation préalable si la cible a déjà des ventes : on préfixe temporairement pour ne
    // pas heurter la contrainte d'unicité pendant la mise à jour.
    if (ventesExistantes > 0) {
      await tx`
        update sales set numero = 'T-' || numero where store_id = ${source.id}
      `;
    }

    // 1. Lignes rattachées à la boutique.
    for (const table of [
      "categories",
      "products",
      "clients",
      "sales",
      "expenses",
      "stock_receipts",
      "documents",
      "cash_counts",
      "notifications",
      "sync_logs",
      "approval_requests",
    ]) {
      const res = await tx.unsafe(`update ${table} set store_id = $1 where store_id = $2`, [
        cible.id,
        source.id,
      ]);
      console.log(`  ${table} : ${res.count} ligne(s)`);
    }

    // 2. Auteurs : tout ce qui pointait vers un compte de la boutique source.
    const utilisateursSource = await tx`select id from users where store_id = ${source.id}`;
    const ids = utilisateursSource.map((u) => u.id as string);
    if (ids.length > 0) {
      for (const [table, colonne] of [
        ["sales", "user_id"],
        ["sales", "approuve_par_id"],
        ["expenses", "user_id"],
        ["stock_receipts", "user_id"],
        ["stock_movements", "user_id"],
        ["cash_counts", "user_id"],
        ["documents", "user_id"],
        ["notifications", "user_id"],
        ["sync_logs", "user_id"],
        ["approval_requests", "demande_par_id"],
        ["approval_requests", "decide_par_id"],
      ]) {
        const res = await tx.unsafe(
          `update ${table} set ${colonne} = $1 where ${colonne} = any($2::text[])`,
          [patronCible.id, ids]
        );
        if (res.count > 0) console.log(`  ${table}.${colonne} : ${res.count} ligne(s) réattribuée(s)`);
      }
    }

    // 3. Appareils de la boutique source : les ventes n'y font plus référence.
    await tx`update sales set device_id = null where device_id in (select id from devices where store_id = ${source.id})`;
    await tx`update sync_logs set device_id = null where device_id in (select id from devices where store_id = ${source.id})`;

    // 4. Réglages en un seul exemplaire par boutique : on ne transfère que si la cible n'en a pas.
    for (const table of ["notification_settings", "mobile_money_settings"]) {
      const dejaLa = await tx.unsafe(`select 1 from ${table} where store_id = $1 limit 1`, [cible.id]);
      if (dejaLa.length > 0) {
        await tx.unsafe(`delete from ${table} where store_id = $1`, [source.id]);
      } else {
        await tx.unsafe(`update ${table} set store_id = $1 where store_id = $2`, [cible.id, source.id]);
      }
    }

    // 5. Renumérotation définitive des ventes transférées, à la suite de celles de la cible.
    if (ventesExistantes > 0) {
      const aRenumeroter = await tx`
        select id from sales where store_id = ${cible.id} and numero like 'T-%' order by date_heure asc
      `;
      let seq = ventesExistantes;
      for (const vente of aRenumeroter) {
        seq += 1;
        await tx`update sales set numero = ${"V-" + String(seq).padStart(4, "0")} where id = ${vente.id}`;
      }
      console.log(`  ${aRenumeroter.length} vente(s) renumérotée(s) à partir de V-${String(ventesExistantes + 1).padStart(4, "0")}`);
    }

    // 6. La boutique source ne contient plus que ses comptes utilisateurs et appareils : la
    //    suppression en cascade les emporte.
    await tx`delete from stores where id = ${source.id}`;
    console.log(`  Boutique « ${source.nom} » supprimée (comptes et appareils inclus).`);
  });

  const [restant] = await db
    .select({ nb: sql<number>`count(*)::int` })
    .from(schema.stores);
  console.log(`Terminé. ${restant.nb} boutique(s) en base.`);

  await pg.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Échec du transfert :", err);
  process.exit(1);
});
