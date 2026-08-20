/**
 * Modèles d'e-mails.
 *
 * Écrits en HTML très simple et avec les styles en ligne : les clients de messagerie ignorent les
 * feuilles de style externes et une bonne partie du CSS moderne. Chaque message part aussi en
 * version texte — c'est ce que voient les clients dépouillés, et son absence pénalise le classement
 * anti-spam.
 *
 * Aucun lien de suivi, aucune image distante : ces messages sont transactionnels, pas du marketing,
 * et une image distante trahirait la lecture du message.
 */

import type { Message } from "./envoyer";

const COULEUR = "#0f766e";

function gabarit(titre: string, corps: string, nomApplication: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(titre)}</title></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#18181b;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
    <tr><td style="padding:24px 24px 8px;">
      <p style="margin:0;font-size:18px;font-weight:700;color:${COULEUR};">${echapper(nomApplication)}</p>
    </td></tr>
    <tr><td style="padding:0 24px 24px;font-size:15px;line-height:1.55;">${corps}</td></tr>
  </table>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
    Message automatique — merci de ne pas y répondre.
  </p>
</body></html>`;
}

/** Empêche qu'un nom saisi par un utilisateur puisse injecter du balisage dans le message. */
function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailReinitialisation(o: {
  nom: string;
  lien: string;
  nomApplication: string;
  valableMinutes: number;
}): Omit<Message, "a"> {
  const sujet = `Réinitialiser votre mot de passe ${o.nomApplication}`;

  const corps = `
    <p style="margin:0 0 12px;">Bonjour ${echapper(o.nom)},</p>
    <p style="margin:0 0 16px;">
      Vous avez demandé à changer le mot de passe de votre compte. Cliquez sur le bouton ci-dessous
      pour en choisir un nouveau.
    </p>
    <p style="margin:0 0 16px;">
      <a href="${o.lien}" style="display:inline-block;padding:12px 20px;background:${COULEUR};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
        Choisir un nouveau mot de passe
      </a>
    </p>
    <p style="margin:0 0 16px;font-size:13px;color:#52525b;">
      Ce lien est valable ${o.valableMinutes} minutes et ne fonctionne qu'une seule fois.
    </p>
    <p style="margin:0 0 6px;font-size:13px;color:#52525b;">
      Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :
    </p>
    <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#52525b;">${o.lien}</p>
    <p style="margin:0;padding-top:16px;border-top:1px solid #e4e4e7;font-size:13px;color:#52525b;">
      <strong>Vous n'avez rien demandé ?</strong> Ignorez ce message : votre mot de passe actuel
      reste valable et personne n'a accès à votre compte.
    </p>`;

  const texte = `Bonjour ${o.nom},

Vous avez demandé à changer le mot de passe de votre compte ${o.nomApplication}.
Ouvrez cette adresse pour en choisir un nouveau :

${o.lien}

Ce lien est valable ${o.valableMinutes} minutes et ne fonctionne qu'une seule fois.

Vous n'avez rien demandé ? Ignorez ce message : votre mot de passe actuel reste
valable et personne n'a accès à votre compte.

— ${o.nomApplication}`;

  return { sujet, html: gabarit(sujet, corps, o.nomApplication), texte };
}

export function emailMotDePasseChange(o: { nom: string; nomApplication: string; contact: string | null }): Omit<Message, "a"> {
  const sujet = `Votre mot de passe ${o.nomApplication} a été changé`;

  // Cet avis est une sécurité à part entière : si quelqu'un s'est emparé de la boîte mail, c'est
  // le seul signal que reçoit le titulaire du compte.
  const recours = o.contact
    ? `Si ce n'est pas vous, contactez immédiatement le support : ${echapper(o.contact)}.`
    : `Si ce n'est pas vous, contactez immédiatement le support.`;

  const corps = `
    <p style="margin:0 0 12px;">Bonjour ${echapper(o.nom)},</p>
    <p style="margin:0 0 16px;">
      Le mot de passe de votre compte vient d'être modifié, et tous vos appareils déjà connectés ont
      été déconnectés.
    </p>
    <p style="margin:0;padding-top:16px;border-top:1px solid #e4e4e7;font-size:13px;color:#52525b;">
      ${recours}
    </p>`;

  const texte = `Bonjour ${o.nom},

Le mot de passe de votre compte ${o.nomApplication} vient d'être modifié, et tous
vos appareils déjà connectés ont été déconnectés.

${o.contact ? `Si ce n'est pas vous, contactez immédiatement le support : ${o.contact}.` : "Si ce n'est pas vous, contactez immédiatement le support."}

— ${o.nomApplication}`;

  return { sujet, html: gabarit(sujet, corps, o.nomApplication), texte };
}
