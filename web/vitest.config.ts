import { defineConfig } from "vitest/config";
import path from "node:path";

// Harnais de tests unitaires — logique métier pure uniquement (voir src/**/*.test.ts).
// Environnement "node" par défaut : ces modules ne touchent ni le DOM ni la base de données.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
    },
  },
});
