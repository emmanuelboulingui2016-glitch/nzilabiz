/**
 * Définit le mot de passe d'un compte, sans jamais l'écrire dans le code.
 *
 *   npm run mdp -- --email=quelquun@exemple.com                 base locale
 *   npm run mdp:prod -- --email=quelquun@exemple.com            base en ligne
 *
 * Le mot de passe est demandé sur l'entrée standard, pas passé en argument : un argument reste
 * dans l'historique du terminal et dans la liste des processus, lisible par n'importe quel autre
 * programme de la machine. Il est aussitôt haché (bcrypt) : la base ne contient jamais le clair.
 */

import dotenv from "dotenv";
import readline from "node:readline";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users } from "../src/db/schema";

const fichierEnv = process.argv.find((a) => a.startsWith("--env="))?.slice(6) ?? ".env";
dotenv.config({ path: fichierEnv });

const email = process.argv.find((a) => a.startsWith("--email="))?.slice(8)?.trim().toLowerCase();

/** Lit une ligne sur l'entrée standard, sans écho quand le terminal le permet. */
function demander(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (reponse) => {
      rl.close();
      resolve(reponse);
    });
  });
}

async function main() {
  if (!email) throw new Error("Usage : --email=adresse@exemple.com [--env=.env.deploy]");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL absent de ${fichierEnv}.`);

  const modeTransaction = /:6543(?:[/?]|$)|pgbouncer=true/.test(url);
  const client = postgres(url, modeTransaction ? { max: 1, prepare: false } : { max: 1 });
  const db = drizzle(client);

  const [compte] = await db.select().from(users).where(eq(users.email, email));
  if (!compte) throw new Error(`Aucun compte avec l'adresse ${email} sur ${url.replace(/^.*@/, "")}`);
  if (compte.desactiveLe) throw new Error("Ce compte a été supprimé par son titulaire.");

  const motDePasse = (process.env.NOUVEAU_MOT_DE_PASSE ?? (await demander("Nouveau mot de passe : "))).trim();
  if (motDePasse.length < 6) throw new Error("Six caractères minimum.");

  await db
    .update(users)
    .set({ motDePasseHash: await bcrypt.hash(motDePasse, 10) })
    .where(eq(users.id, compte.id));

  console.log(`Mot de passe mis à jour pour ${compte.nom} <${compte.email}> (${compte.role}).`);
  await client.end();
}

main().catch((e) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
