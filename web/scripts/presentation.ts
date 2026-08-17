/**
 * Mode présentation — faire tourner NzilaBiz sur un téléphone sans rien mettre en ligne.
 *
 * Démarre le serveur en écoutant sur toutes les cartes réseau, puis affiche dans le terminal
 * l'adresse et le QR code à scanner. Deux façons de s'en servir :
 *
 *   npm run presentation            réseau local — le téléphone doit être sur le même Wi-Fi.
 *                                   Aucune donnée ne sort du réseau, marche sans Internet.
 *   npm run presentation -- --tunnel  ouvre en plus une adresse HTTPS publique via ngrok.
 *                                   Nécessite Internet, et permet l'installation en vraie
 *                                   application (PWA) et le mode hors ligne.
 *
 * Options : --dev (mode développement), --port=3000.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { adressesLocales } from "../src/lib/reseau/adresse-locale";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const modeDev = args.includes("--dev");
const avecTunnel = args.includes("--tunnel");
const port = Number(args.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3000);

const GRAS = "[1m";
const VERT = "[32m";
const JAUNE = "[33m";
const GRIS = "[90m";
const FIN = "[0m";

const enfants: ChildProcess[] = [];

function titre(texte: string) {
  console.log(`\n${GRAS}${texte}${FIN}`);
}

async function qrTerminal(url: string) {
  // `small` utilise des demi-blocs : le code tient dans une fenêtre de terminal normale.
  return QRCode.toString(url, { type: "terminal", small: true, errorCorrectionLevel: "M" });
}

/**
 * Vrai si quelque chose écoute déjà sur le port. Sans cette vérification, un serveur oublié dans
 * une autre fenêtre répondrait à la place du nouveau : on afficherait un QR code vers une version
 * périmée de l'application, sans le moindre message d'erreur.
 */
function portOccupe(): Promise<boolean> {
  return new Promise((resolve) => {
    const sonde = net
      .createServer()
      .once("error", (e: NodeJS.ErrnoException) => resolve(e.code === "EADDRINUSE"))
      .once("listening", () => sonde.close(() => resolve(false)))
      .listen(port, "0.0.0.0");
  });
}

/** Attend que le serveur réponde, ou abandonne s'il s'arrête ou dépasse le délai. */
async function attendreServeur(serveur: ChildProcess, timeoutMs = 120_000): Promise<boolean> {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    if (serveur.exitCode !== null || serveur.signalCode !== null) return false;
    try {
      await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  return false;
}

/** Démarre ngrok et récupère l'adresse publique via son interface locale. */
async function ouvrirTunnel(): Promise<string | null> {
  const ngrok = spawn("ngrok", ["http", String(port), "--log", "stdout"], { stdio: "ignore" });
  ngrok.on("error", () => {
    /* ngrok absent du système : traité par l'absence d'URL au bout du délai. */
  });
  enfants.push(ngrok);

  const limite = Date.now() + 25_000;
  while (Date.now() < limite) {
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      const data = (await res.json()) as { tunnels?: { public_url?: string }[] };
      const url = data.tunnels?.find((t) => t.public_url?.startsWith("https://"))?.public_url;
      if (url) return url;
    } catch {
      // ngrok n'a pas encore ouvert son interface locale.
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

async function main() {
  if (!modeDev && !existsSync(path.join(racine, ".next", "BUILD_ID"))) {
    console.error(
      `${JAUNE}Aucune version compilée trouvée.${FIN}\n` +
        `Lancez d'abord ${GRAS}npm run build${FIN}, ou ajoutez ${GRAS}--dev${FIN} pour démarrer sans compiler.`,
    );
    process.exit(1);
  }

  if (await portOccupe()) {
    console.error(
      `${JAUNE}Le port ${port} est déjà utilisé.${FIN}\n` +
        `Fermez la fenêtre qui fait déjà tourner l'application, ou choisissez un autre port :\n` +
        `${GRAS}npm run presentation -- --port=3001${FIN}`,
    );
    process.exit(1);
  }

  const adresses = adressesLocales();
  if (adresses.length === 0) {
    console.log(
      `${JAUNE}Cet ordinateur n'est connecté à aucun réseau.${FIN} Connectez-le au Wi-Fi, ou activez le\n` +
        `partage de connexion du téléphone et connectez l'ordinateur dessus.\n`,
    );
  }

  console.log(`${GRIS}Démarrage du serveur…${FIN}`);

  const serveur = spawn(
    process.execPath,
    [
      path.join(racine, "node_modules", "next", "dist", "bin", "next"),
      modeDev ? "dev" : "start",
      "-H",
      "0.0.0.0",
      "-p",
      String(port),
    ],
    {
      cwd: racine,
      // MODE_PRESENTATION assouplit deux réglages incompatibles avec le HTTP : le cookie de
      // session marqué « Secure » et l'en-tête HSTS. Sans cela, la connexion depuis le téléphone
      // échoue sans message d'erreur.
      env: { ...process.env, MODE_PRESENTATION: "1" },
      stdio: "inherit",
    },
  );
  enfants.push(serveur);
  serveur.on("exit", (code) => process.exit(code ?? 0));

  if (!(await attendreServeur(serveur))) {
    console.error(`\n${JAUNE}Le serveur n'a pas démarré.${FIN} Vérifiez les messages ci-dessus.`);
    return;
  }

  titre("Présentation prête");

  for (const { interface: carte, adresse } of adresses) {
    const url = `http://${adresse}:${port}`;
    console.log(`\n${GRIS}${carte}${FIN}   ${VERT}${GRAS}${url}${FIN}`);
    if (adresse === adresses[0].adresse) console.log(await qrTerminal(url));
  }

  if (avecTunnel) {
    console.log(`${GRIS}Ouverture du tunnel HTTPS…${FIN}`);
    const url = await ouvrirTunnel();
    if (url) {
      titre("Adresse HTTPS publique (installation en application et mode hors ligne)");
      console.log(`\n${VERT}${GRAS}${url}${FIN}`);
      console.log(await qrTerminal(url));
      console.log(
        `${GRIS}Au premier accès, ngrok affiche une page d'avertissement : touchez « Visit Site ».${FIN}\n` +
          `${JAUNE}Attention :${FIN} cette adresse est accessible depuis Internet par toute personne\n` +
          `qui la connaît, et vos données réelles sont derrière. Elle se ferme dès que vous arrêtez\n` +
          `ce terminal (Ctrl+C).\n`,
      );
    } else {
      console.log(
        `${JAUNE}Tunnel indisponible.${FIN} Vérifiez qu'ngrok est installé et connecté\n` +
          `(${GRAS}ngrok config add-authtoken …${FIN}), ou restez sur le réseau local ci-dessus.\n`,
      );
    }
  }

  console.log(
    `${GRIS}Sur le téléphone : appareil photo → viser le QR code → toucher la notification.\n` +
      `Un QR code plus grand est disponible dans l'application : Paramètres → Aide & support.\n` +
      `Si le téléphone n'ouvre rien, autorisez Node.js dans le pare-feu Windows (réseau privé).\n` +
      `Ctrl+C pour tout arrêter.${FIN}`,
  );
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    for (const enfant of enfants) enfant.kill();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
