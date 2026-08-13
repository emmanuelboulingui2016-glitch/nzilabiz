// Applique les migrations SQL générées (drizzle/*.sql) sur la base pointée par DATABASE_URL.
// Usage : npm run db:migrate
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://nzilabiz:nzilabiz_dev_password@localhost:5432/nzilabiz";
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  console.log("Application des migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées avec succès.");
  await sql.end();
}

main().catch((err) => {
  console.error("Échec des migrations :", err);
  process.exit(1);
});
