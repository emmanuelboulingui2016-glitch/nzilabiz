/**
 * Envoi d'e-mails transactionnels.
 *
 * Deux voies possibles, choisies par les variables d'environnement présentes. Aucune n'est
 * obligatoire : sans configuration, l'application fonctionne exactement comme avant et les écrans
 * qui dépendent de l'e-mail se replient sur leur version manuelle, plutôt que de proposer un
 * formulaire qui n'aboutirait pas.
 *
 *   1. SMTP — SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 *      Fonctionne immédiatement avec un compte Gmail et un « mot de passe d'application » : rien à
 *      créer, aucun DNS à modifier. Plafonné à ~500 envois par jour, ce qui couvre largement une
 *      période de test.
 *
 *   2. Resend — RESEND_API_KEY
 *      Meilleure remise sur le long terme et expéditeur à votre domaine, mais exige un compte et
 *      la vérification du domaine par enregistrements DNS.
 *
 * Resend est préféré s'il est configuré. Appelé par HTTP directement : une dépendance de moins.
 */

import nodemailer from "nodemailer";

export type Message = {
  a: string;
  sujet: string;
  html: string;
  texte: string;
};

function expediteur(): string {
  return process.env.EMAIL_EXPEDITEUR?.trim() || process.env.SMTP_USER?.trim() || "";
}

function viaResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && expediteur());
}

function viaSmtp(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASSWORD?.trim() &&
      expediteur()
  );
}

/**
 * L'application sait-elle envoyer un e-mail ? À consulter côté serveur avant d'afficher un écran
 * qui en dépend — même discipline que pour la connexion Google.
 */
export function emailConfigure(): boolean {
  return viaResend() || viaSmtp();
}

/**
 * Envoie le message. Renvoie `false` en cas d'échec au lieu de propager l'erreur : l'appelant ne
 * doit jamais laisser une panne d'e-mail révéler quoi que ce soit au visiteur — notamment pas
 * l'existence d'un compte.
 */
export async function envoyerEmail(m: Message): Promise<boolean> {
  try {
    if (viaResend()) return await parResend(m);
    if (viaSmtp()) return await parSmtp(m);
    console.error("e-mail : aucun fournisseur configuré, message non envoyé.");
    return false;
  } catch (e) {
    // Le contenu du message n'est jamais journalisé : il porte un lien de réinitialisation.
    console.error(`e-mail : échec d'envoi (${m.sujet}) —`, e instanceof Error ? e.message : e);
    return false;
  }
}

async function parResend(m: Message): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: expediteur(),
      to: [m.a],
      subject: m.sujet,
      html: m.html,
      text: m.texte,
    }),
  });
  if (!res.ok) {
    console.error(`e-mail : Resend a refusé l'envoi (HTTP ${res.status}) — ${await res.text()}`);
    return false;
  }
  return true;
}

async function parSmtp(m: Message): Promise<boolean> {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    // 465 est chiffré dès la connexion ; 587 démarre en clair puis bascule en TLS (STARTTLS).
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!.trim(), pass: process.env.SMTP_PASSWORD!.trim() },
  });
  await transport.sendMail({
    from: expediteur(),
    to: m.a,
    subject: m.sujet,
    text: m.texte,
    html: m.html,
  });
  return true;
}
