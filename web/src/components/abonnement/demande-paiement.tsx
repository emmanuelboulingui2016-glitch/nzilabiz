"use client";

// Bandeau « paiement en attente » — écran Abonnement du commerçant.
//
// Le propriétaire de la plateforme fixe le tarif Entreprise et émet la demande depuis son panneau
// d'administration (voir `src/components/superadmin/formule-entreprise.tsx`) ; ce composant se
// contente de l'afficher au commerçant, avec un moyen de payer en attendant qu'un agrégateur
// Mobile Money soit branché. Auto-suffisant : il charge sa propre donnée (`GET /api/abonnement`),
// il n'a besoin que des coordonnées de contact en prop.
//
// Ne s'affiche que s'il y a effectivement une demande en attente — sinon `null`, silencieux : un
// commerçant à jour ne doit rien voir de cet écran.

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContactSupport, lienWhatsapp } from "@/components/contact-support";
import type { ContactCommercial } from "@/lib/platform-settings";
import { LIBELLE_CYCLE, type Cycle } from "@/lib/tarifs";
import { formatFcfa } from "@/lib/currency";

type Demande = {
  id: string;
  plan: string;
  cycle: string;
  montant: number;
  devise: string;
  periodeDebut: string;
  periodeFin: string;
  creeLe: string;
};

function dateCourte(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function DemandePaiement({ contact }: { contact: ContactCommercial }) {
  const [demande, setDemande] = useState<Demande | null>(null);
  const [chargee, setChargee] = useState(false);

  useEffect(() => {
    fetch("/api/abonnement")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("chargement"))))
      .then((data) => setDemande(data.demande ?? null))
      .catch(() => setDemande(null))
      .finally(() => setChargee(true));
  }, []);

  if (!chargee || !demande) return null;

  const message = `Bonjour, je vous confirme le paiement de ${formatFcfa(demande.montant, demande.devise)} pour mon abonnement NzilaBiz (période du ${dateCourte(
    demande.periodeDebut
  )} au ${dateCourte(demande.periodeFin)}).`;
  const whatsapp = lienWhatsapp(contact, message);

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          Paiement en attente
          <Badge tone="warning">En attente de confirmation</Badge>
        </p>
        <p className="text-sm text-muted-foreground">
          Le tarif négocié pour votre boutique a été fixé à{" "}
          <strong className="text-foreground">{formatFcfa(demande.montant, demande.devise)}</strong>{" "}
          ({LIBELLE_CYCLE[demande.cycle as Cycle] ?? demande.cycle}), pour la période du{" "}
          {dateCourte(demande.periodeDebut)} au {dateCourte(demande.periodeFin)}. Aucun paiement automatique
          n&apos;est encore possible dans l&apos;application : réglez-le directement auprès de NzilaBiz, qui
          confirmera la réception dès qu&apos;elle sera reçue.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-start gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
            >
              <MessageCircle size={16} />
              Confirmer via WhatsApp
            </a>
          ) : (
            <ContactSupport contact={contact} sujet="Paiement de mon abonnement Entreprise" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
