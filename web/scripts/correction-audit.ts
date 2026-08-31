/**
 * Corrections de données issues de l'audit de sécurité — à exécuter une seule fois.
 *
 *   npm run audit:corriger        base locale
 *   npm run audit:corriger:prod   base en ligne
 *
 * Deux corrections, à passer AVANT le déploiement du blocage à l'expiration :
 *
 *   1. La boutique « Harvester Librairie » s'est inscrite sans le lien testeur : son essai se
 *      terminait cinq jours avant la fin du programme de test. Alignée sur la date du programme et
 *      marquée testeur.
 *
 *   2. Les deux comptes de démonstration partageaient le mot de passe de l'administrateur de la
 *      plateforme. Chacun reçoit le sien, tiré au hasard. Les mots de passe sont écrits dans
 *      sauvegardes/ et ne sont jamais affichés à l'écran ni journalisés.
 */

import dotenv from "dotenv";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { stores, users } from "../src/db/schema";

const fichierEnv = process.argv.find((a) => a.startsWith("--env="))?.slice(6) ?? ".env";
dotenv.config({ path: fichierEnv });

/** Même forme que les mots de passe temporaires du reste de l'application. */
function motDePasse(): string {
  return randomBytes(9).toString("base64").replace(/[^A-Za-z0-9]/g, "") + "9!";
}

const COMPTES_DEMO = ["gerante.demo@nzilabiz.store", "vendeur.demo@nzilabiz.store"];
const FIN_PROGRAMME = new Date("2026-09-18T23:59:59.000Z");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL absent de ${fichierEnv}.`);

  const client = postgres(url, /:6543(?:[/?]|$)|pgbouncer=true/.test(url) ? { max: 1, prepare: false } : { max: 1 });
  const db = drizzle(client, { schema: { stores, users } });

  const lignes: string[] = [
    "Corrections de données — audit de sécurité",
    `Base : ${url.replace(/:\/\/[^@]*@/, "://***@")}`,
    `Date : ${new Date().toISOString()}`,
    "",
  ];

  // ---------------------------------------------------------------- 1. Harvester Librairie
  const [harvester] = await db.select().from(stores).where(eq(stores.nom, "Harvester Librairie"));
  if (!harvester) {
    console.log("• Boutique « Harvester Librairie » introuvable — rien à faire.");
  } else {
    const avant = harvester.essaiExpireLe?.toISOString().slice(0, 10) ?? "—";
    await db
      .update(stores)
      .set({ essaiExpireLe: FIN_PROGRAMME, programmeTest: true })
      .where(eq(stores.id, harvester.id));
    console.log(`• Harvester Librairie : essai ${avant} → 2026-09-18, marquée testeur.`);
    lignes.push(`Harvester Librairie : essai ${avant} → 2026-09-18, programmeTest = true`, "");
  }

  // ---------------------------------------------------------------- 2. Comptes de démonstration
  lignes.push("Comptes de démonstration — mots de passe distincts :");
  for (const email of COMPTES_DEMO) {
    const [compte] = await db.select().from(users).where(eq(users.email, email));
    if (!compte) {
      console.log(`• ${email} : introuvable — ignoré.`);
      continue;
    }
    const mdp = motDePasse();
    await db.update(users).set({ motDePasseHash: await bcrypt.hash(mdp, 10) }).where(eq(users.id, compte.id));
    // Le mot de passe part dans le fichier, jamais dans la console : cette sortie finit souvent
    // recopiée dans une conversation.
    lignes.push(`  ${email}   ${mdp}`);
    console.log(`• ${email} : nouveau mot de passe, distinct de celui de l'administrateur.`);
  }

  fs.mkdirSync("sauvegardes", { recursive: true });
  fs.appendFileSync("sauvegardes/compte-administrateur.txt", "\n\n" + lignes.join("\n") + "\n");
  console.log("\nMots de passe → sauvegardes/compte-administrateur.txt (jamais affichés ici).");

  await client.end();
}

main().catch((e) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
