import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { connectionStringRequise, estModeTransaction } from "./connection-string";

declare global {
  // eslint-disable-next-line no-var
  var __nzilabiz_pg__: ReturnType<typeof postgres> | undefined;
}

const connectionString = connectionStringRequise("l'application");

// Hébergement sans serveur (Vercel, Netlify) : chaque requête peut réveiller une instance
// différente, et 10 connexions par instance épuisent le serveur Postgres en quelques minutes. On
// passe alors par un pooler en **mode transaction** — port 6543 chez Supabase — qui impose deux
// contraintes : une seule connexion par instance, et pas d'instructions préparées, le pooler ne
// garantissant pas de retomber sur la même session d'une requête à l'autre.
//
// La détection porte sur le port et non sur le nom d'hôte : le pooler « session » de Supabase est
// sur le même hôte mais sur le port 5432, accepte les instructions préparées et plusieurs
// connexions. Le confondre avec le mode transaction briderait inutilement un serveur persistant.
//
// Passer par la chaîne de connexion plutôt que par une variable dédiée évite d'oublier de la
// positionner, et laisse le développement local en connexion directe inchangé.
const modeTransaction = estModeTransaction(connectionString);

// Réutilise la connexion entre rechargements à chaud en dev (évite d'épuiser le pool Postgres).
// Trois connexions et non une seule en mode transaction. Avec une connexion unique, postgres.js
// empile les requêtes simultanées d'une même requête HTTP sur le même canal ; à travers le pooler,
// cet empilement se traduit par des réponses qui n'arrivent jamais et une fonction qui expire au
// bout de cinq minutes, sans erreur exploitable. Trois reste très en dessous de ce qu'un pooler en
// mode transaction est fait pour absorber, tout en couvrant les écrans qui agrègent plusieurs
// compteurs à la fois.
//
// `connect_timeout` et `idle_timeout` sont explicites : sans eux, une connexion qui n'aboutit pas
// laisse la fonction tourner jusqu'à l'expiration de la plateforme, cinq minutes plus tard, sans
// message. Mieux vaut échouer en quinze secondes avec une erreur lisible.
const client =
  global.__nzilabiz_pg__ ??
  postgres(
    connectionString,
    modeTransaction
      ? { max: 3, prepare: false, connect_timeout: 15, idle_timeout: 20 }
      : { max: 10 },
  );

// postgres.js rejette les requêtes encore en vol quand une connexion tombe. Si elles appartiennent
// à un `Promise.all` dont une autre a déjà échoué, ces rejets n'ont plus personne pour les
// attraper : Node considère le rejet non géré comme fatal et termine le processus, ce que la
// plateforme rapporte en 504 après cinq minutes plutôt qu'en erreur immédiate. On les journalise
// et on laisse le processus vivre.
process.on("unhandledRejection", (raison) => {
  console.error("Rejet non géré (probablement une requête interrompue) :", raison);
});

if (process.env.NODE_ENV !== "production") {
  global.__nzilabiz_pg__ = client;
}

export const db = drizzle(client, { schema });
