/**
 * Vérifie qu'une base est joignable et affiche ce qu'elle contient déjà.
 *
 *   npm run db:check              base locale (web/.env)
 *   npm run db:check:prod         base en ligne (web/.env.deploy)
 *
 * Sert avant une migration : savoir si l'on parle bien à la bonne base, et si elle est vide ou
 * déjà peuplée, évite d'appliquer un schéma au mauvais endroit. Aucun secret n'est affiché.
 */

import dotenv from "dotenv";
import postgres from "postgres";

const fichierEnv = process.argv.find((a) => a.startsWith("--env="))?.slice("--env=".length) ?? ".env";
const charge = dotenv.config({ path: fichierEnv });

async function main() {
  if (charge.error) throw new Error(`Fichier d'environnement introuvable : ${fichierEnv}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`DATABASE_URL absent de ${fichierEnv}.`);

  // Tout ce qui précède « @ » contient l'identifiant et le mot de passe : on ne montre que la cible.
  const cible = url.replace(/^.*@/, "").replace(/\?.*$/, "");
  console.log(`Cible : ${cible}  (source : ${fichierEnv})`);

  const sql = postgres(url, { max: 1, connect_timeout: 20 });
  try {
    const [info] = await sql`select current_database() as base, inet_server_port() as port`;
    console.log(`Connexion établie — base « ${info.base} », port ${info.port}.`);

    const tables = await sql<{ nom: string; lignes: number }[]>`
      select c.relname as nom, c.reltuples::bigint as lignes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `;
    if (tables.length === 0) {
      console.log("La base est vide : aucune table dans le schéma public.");
    } else {
      console.log(`${tables.length} tables présentes :`);
      for (const t of tables) console.log(`  ${t.nom} (~${t.lignes} lignes)`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Échec :", err instanceof Error ? err.message : err);
  process.exit(1);
});
