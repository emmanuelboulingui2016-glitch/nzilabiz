import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __nzilabiz_pg__: ReturnType<typeof postgres> | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://nzilabiz:nzilabiz_dev_password@localhost:5432/nzilabiz";

// Réutilise la connexion entre rechargements à chaud en dev (évite d'épuiser le pool Postgres).
const client =
  global.__nzilabiz_pg__ ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  global.__nzilabiz_pg__ = client;
}

export const db = drizzle(client, { schema });
