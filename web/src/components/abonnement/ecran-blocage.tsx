import { Lock, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlatformSettings, whatsappLien } from "@/lib/platform-settings";
import { messageBlocage, type EtatBoutique } from "@/lib/abonnement";
import { BoutonDeconnexion } from "./bouton-deconnexion";

/**
 * Écran affiché à la place de l'application quand l'échéance d'une boutique est passée.
 *
 * Il remplace les enfants du calque plutôt que de rediriger : un calque Next.js ne connaît pas le
 * chemin courant, et une redirection vers une page elle-même située sous ce calque tournerait en
 * boucle.
 *
 * Il donne toujours un moyen de joindre le support. Un commerçant bloqué ne peut aujourd'hui pas
 * payer depuis l'application — lui fermer la porte sans lui laisser de numéro serait le laisser
 * sans recours.
 */
export async function EcranBlocage({ etat, nomBoutique }: { etat: EtatBoutique; nomBoutique: string }) {
  const r = await getPlatformSettings();
  const whatsapp = whatsappLien(
    r.supportWhatsapp,
    `Bonjour, ma boutique « ${nomBoutique} » est bloquée. Je souhaite la réactiver.`
  );

  const dateFin = etat.expireLe
    ? etat.expireLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <Lock size={22} className="text-warning" />
        </div>

        <h1 className="text-lg font-bold">{messageBlocage(etat.raison ?? "ESSAI_EXPIRE")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L&apos;accès à <strong className="text-foreground">{nomBoutique}</strong> est suspendu
          {dateFin ? <> depuis le {dateFin}</> : null}. Vos données sont conservées intégralement et
          vous les retrouverez dès la réactivation.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-background p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-bold">
            <LifeBuoy size={15} className="text-primary" /> Réactiver votre boutique
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Contactez-nous : nous rouvrons votre accès dans la journée.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <Button size="sm">WhatsApp</Button>
              </a>
            ) : null}
            {r.supportTelephone ? (
              <a href={`tel:${r.supportTelephone.replace(/\s/g, "")}`}>
                <Button variant="outline" size="sm">
                  {r.supportTelephone}
                </Button>
              </a>
            ) : null}
            {r.supportEmail ? (
              <a href={`mailto:${r.supportEmail}?subject=${encodeURIComponent(`Réactivation — ${nomBoutique}`)}`}>
                <Button variant="outline" size="sm">
                  {r.supportEmail}
                </Button>
              </a>
            ) : null}
          </div>
          {!whatsapp && !r.supportTelephone && !r.supportEmail ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Aucun contact de support n&apos;est encore publié.
            </p>
          ) : null}
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Formule actuelle : <strong className="text-foreground">{etat.plan}</strong>
        </p>

        <BoutonDeconnexion />
      </div>
    </div>
  );
}
