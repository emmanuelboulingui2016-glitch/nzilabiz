import dotenv from "dotenv";
import postgres from "postgres";
async function main() {
  dotenv.config({ path: ".env.deploy" });
  const url = process.env.DATABASE_URL!;
  const sql = postgres(url, /:6543/.test(url) ? { max: 1, prepare: false } : { max: 1 });
  const action = process.argv[2];
  if (action === "expirer") {
    await sql`update stores set abonnement_expire_le = now() - interval '1 day'
              where nom = 'Boutique Démonstration'`;
    console.log("  boutique de demonstration : echeance placee HIER");
  } else {
    await sql`update stores set abonnement_expire_le = null where nom = 'Boutique Démonstration'`;
    console.log("  boutique de demonstration : echeance REMISE A NULL (etat d'origine)");
  }
  await sql.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
