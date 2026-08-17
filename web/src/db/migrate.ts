// Applique les migrations SQL générées (drizzle/*.sql) sur la base pointée par DATABASE_URL.
//
// Usage :
//   npm run db:migrate                 base locale, lit web/.env
//   npm run db:migrate:prod            base en ligne, lit web/.env.deploy
//
// Le fichier d'environnement est choisi par `--env=<chemin>` plutôt qu'en exportant DATABASE_URL
// dans le terminal : le mot de passe de la base de production ne passe alors ni par la ligne de
// commande ni par l'historique du shell, et la configuration locale reste intacte.
//
// Le nom `.env.deploy` n'est pas un hasard : Next.js charge tout seul `.env.production` et
// `.env.production.local` dès que NODE_ENV vaut production. Y mettre la base en ligne suffirait à
// ce qu'un `npm run build` ou une démonstration locale s'y branche sans prévenir.
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const fichierEnv = process.argv.find((a) => a.startsWith("--env="))?.slice("--env=".length) ?? ".env";
const charge = dotenv.config({ path: fichierEnv });

async function main() {
  if (charge.error) {
    throw new Error(
      `Fichier d'environnement introuvable : ${fichierEnv}\n` +
        `Créez-le à côté de package.json et renseignez-y DATABASE_URL.`,
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(`DATABASE_URL absent de ${fichierEnv}.`);
  }

  // Le pooler en mode transaction (port 6543) interdit les instructions préparées nommées : le
  // pilote doit passer en requêtes non préparées. C'est souvent la seule voie disponible, beaucoup
  // de réseaux bloquant le port 5432 en sortie.
  const modeTransaction = /:6543(?:[/?]|$)|pgbouncer=true/.test(connectionString);

  // Masque tout sauf l'hôte : on veut pouvoir vérifier la cible sans exposer le mot de passe.
  const hote = connectionString.replace(/^.*@/, "").replace(/\?.*$/, "");
  console.log(
    `Application des migrations sur ${hote} (source : ${fichierEnv})` +
      `${modeTransaction ? ", en mode transaction" : ""}…`,
  );

  const sql = postgres(connectionString, modeTransaction ? { max: 1, prepare: false } : { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées avec succès.");
  await sql.end();
}

main().catch((err) => {
  console.error("Échec des migrations :", err instanceof Error ? err.message : err);
  process.exit(1);
});
