// Implémentation TOTP minimale (RFC 6238 / HOTP RFC 4226), sans dépendance externe (aucune lib
// otplib/speakeasy dans le projet). Utilisée uniquement côté serveur par
// src/app/api/parametres/securite/route.ts pour l'activation optionnelle du 2FA (§14 🔧).
//
// ⚠️ Simplification honnête : ce module génère/vérifie des codes TOTP à 6 chiffres, pas-30s,
// SHA-1 (standard Google Authenticator / Authy). Il n'y a PAS de QR code généré ici — l'utilisateur
// entre le secret manuellement dans son appli d'authentification, ce qui est explicitement accepté
// comme simplification par la consigne de tâche. Voir aussi le résumé final : l'ACTIVATION du flag
// `users.twoFactorActive` fonctionne réellement (secret + vérification d'un vrai code TOTP), mais
// le flux de LOGIN ne demande pas encore ce second facteur (non câblé dans ce build — hors périmètre
// des fichiers autorisés pour cet agent, qui ne touche pas /api/auth/login).

import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(byteLength = 16): string {
  const bytes = randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 1_000_000).padStart(6, "0");
}

/** Vérifie un code TOTP à 6 chiffres avec une tolérance de ±1 pas (30s) pour l'horloge. */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const cleanCode = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i) === cleanCode) return true;
  }
  return false;
}

/** Chaîne d'entrée manuelle formatée par groupes de 4 (plus lisible qu'un secret brut). */
export function formatSecretForDisplay(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
