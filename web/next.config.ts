import type { NextConfig } from "next";
import { adressesLocales } from "./src/lib/reseau/adresse-locale";

// En-têtes de sécurité appliqués à toutes les réponses.
//
// La CSP autorise 'unsafe-inline' pour les styles (Tailwind injecte des styles en ligne) et
// 'unsafe-eval' en développement uniquement (le rafraîchissement à chaud de Turbopack en a
// besoin). `img-src data:` est nécessaire : les photos de produits et les logos de boutique sont
// stockés en data URL base64 dans la base.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Les appels sortants restent sur la même origine ; ws: couvre le HMR en développement.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  // HSTS n'est volontairement pas ici : ces en-têtes sont figés au moment de la compilation, or
  // une même version compilée sert en ligne (HTTPS) comme en présentation sur le réseau local
  // (HTTP). Il est ajouté à l'exécution, selon le protocole réel, dans `src/proxy.ts`.
];

const nextConfig: NextConfig = {
  // En développement, Next refuse les requêtes internes venant d'une autre origine que localhost.
  // Sans cette liste, une démonstration sur téléphone via l'IP de l'ordinateur perd les styles et
  // le rafraîchissement à chaud. Les adresses sont détectées au démarrage et restent privées.
  allowedDevOrigins: adressesLocales().map((a) => a.adresse),
  // Nodemailer ouvre lui-même une connexion TCP et charge ses modules à l'exécution : empaqueté
  // par le compilateur, il perd cette capacité. On le laisse être chargé normalement par Node.
  serverExternalPackages: ["nodemailer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
