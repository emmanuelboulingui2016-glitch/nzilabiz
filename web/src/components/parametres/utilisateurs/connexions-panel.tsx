// Connexions récentes des employés — §14, demande du propriétaire : « les connexions des employés
// restent inaperçues ». La table `devices` suffit (chaque connexion y insère une ligne, voir
// schema.ts) : ce panneau se contente de la mettre en avant, sur l'écran Utilisateurs plutôt que
// Synchronisation. Deux raisons à ce choix :
//   1. Synchronisation est accessible au Gérant (permission `synchronisation.view`), Utilisateurs ne
//      l'est qu'au Patron (`parametres.utilisateurs`) — la question posée est celle du propriétaire
//      qui surveille QUI se connecte, un besoin d'administration des comptes, pas de diagnostic de
//      synchronisation technique.
//   2. Le rapprochement est immédiat avec la liste des membres juste au-dessus : pas besoin de
//      changer d'écran pour relier une connexion à un nom.
//
// Composant serveur pur (pas de "use client") : purement informatif, aucune interaction, aucune
// donnée d'état à gérer côté client.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogIn } from "lucide-react";
import type { ConnexionRecente } from "@/components/parametres/utilisateurs/queries";
import { estAujourdHuiPourLeCommercant, heureLocaleCommercant } from "@/components/parametres/utilisateurs/queries";

/** Résumé lisible d'un user-agent : type d'appareil plutôt que la chaîne technique brute. */
function resumeAppareil(userAgent: string | null): string {
  if (!userAgent) return "Appareil inconnu";
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iPhone/iPad";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "Mac";
  return "Navigateur";
}

/** "Aujourd'hui à 14:32" si la connexion est du jour du commerçant (Africa/Libreville), sinon une date. */
function libelleMoment(date: Date): string {
  if (estAujourdHuiPourLeCommercant(date)) {
    return `Aujourd'hui à ${heureLocaleCommercant(date)}`;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Libreville",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ConnexionsPanel({ connexions }: { connexions: ConnexionRecente[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
          <LogIn size={16} /> Connexions récentes
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Qui s&apos;est connecté, quand, et depuis quel appareil — les dix dernières connexions
          d&apos;employés à cette boutique.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {connexions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Aucune connexion enregistrée pour le moment.</p>
        ) : (
          connexions.slice(0, 10).map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {c.userNom ?? "Compte supprimé"}
                  {c.revoque ? (
                    <Badge tone="danger" className="ml-2">
                      Révoqué
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {resumeAppareil(c.userAgent)} · {c.appareil}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{libelleMoment(c.derniereActivite)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
