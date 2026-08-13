"use client";

import { Paperclip } from "lucide-react";

/**
 * Aperçu d'une pièce jointe (photo du reçu/facture). Stockée en data URL base64 directement dans
 * `pieceJointeUrl` — il n'y a pas de service de stockage d'objets (S3/Cloud Storage) disponible
 * dans cet environnement de build, c'est une simplification volontaire documentée dans le résumé.
 */
export function ExpenseAttachmentThumb({ url }: { url: string }) {
  const isImage = url.startsWith("data:image/");
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      title="Voir la pièce jointe"
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Reçu / facture" className="h-6 w-6 rounded object-cover" />
      ) : (
        <Paperclip size={14} />
      )}
      <span>Reçu</span>
    </a>
  );
}
