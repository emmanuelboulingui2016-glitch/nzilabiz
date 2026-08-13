"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { formatFcfa } from "@/lib/currency";
import { toWhatsAppPhone, type ClientCreance } from "./types";

// 🔧 Relances automatiques par WhatsApp/SMS (§9) : sans API SMS/WhatsApp Business configurée,
// on ouvre un lien wa.me avec un message pré-rempli et modifiable par l'utilisateur.
function buildDefaultMessage(client: ClientCreance): string {
  const montant = formatFcfa(client.solde);
  if (client.joursRetard && client.joursRetard > 0) {
    return `Bonjour ${client.nom}, ceci est un rappel amical : votre solde créance de ${montant} est en retard de ${client.joursRetard} jour(s). Merci de régulariser dès que possible. Bonne journée !`;
  }
  const echeance = client.dateEcheance
    ? new Date(client.dateEcheance).toLocaleDateString("fr-FR")
    : null;
  return `Bonjour ${client.nom}, pour rappel votre solde créance est de ${montant}${
    echeance ? `, à régler avant le ${echeance}` : ""
  }. Merci de votre confiance !`;
}

export function RelanceDialog({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client: ClientCreance | null;
}) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (client) setMessage(buildDefaultMessage(client));
  }, [client]);

  if (!client) return null;

  const phone = toWhatsAppPhone(client.telephone);

  function handleSend() {
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Relancer — ${client.nom}`}>
      <div className="space-y-3">
        {!phone ? (
          <p className="text-sm text-warning">
            Aucun numéro de téléphone enregistré pour ce client : vous pourrez choisir un contact
            manuellement dans WhatsApp.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Envoi vers WhatsApp au +{phone}</p>
        )}
        <div>
          <Label htmlFor="relance-message">Message (modifiable)</Label>
          <Textarea
            id="relance-message"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={!message.trim()}>
            Ouvrir WhatsApp
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
