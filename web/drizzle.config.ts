import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { connectionStringRequise } from "./src/db/connection-string";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionStringRequise("drizzle-kit"),
  },
});
