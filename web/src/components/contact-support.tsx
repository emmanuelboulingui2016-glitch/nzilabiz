import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui";
import type { ContactCommercial } from "@/lib/platform-settings";

/**
 * Boutons « Nous contacter » — les coordonnées viennent des réglages de la plateforme.
 *
 * Elles étaient jusqu'ici écrites en dur dans deux pages, sous la forme d'un `mailto:` vers une
 * boîte hébergée sur `nzilabiz.com` alors que le site est publié sur `nzilabiz.store`. Un lien
 * `mailto:` ne rate jamais visiblement : le visiteur croyait avoir écrit, personne ne recevait
 * rien. Un seul composant, une seule source, et le jour où le numéro change il ne change qu'à un
 * endroit.
 *
 * Quand aucun contact n'est publié, on le dit plutôt que d'afficher un bouton qui ne mène nulle
 * part.
 */
export function ContactSupport({ contact, sujet }: { contact: ContactCommercial; sujet: string }) {
  if (!contact.whatsapp && !contact.telephone && !contact.email) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LifeBuoy size={13} />
        Aucun contact commercial n&apos;est encore publié.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {contact.whatsapp ? (
        <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">
          <Button size="sm">WhatsApp</Button>
        </a>
      ) : null}
      {contact.telephone ? (
        <a href={`tel:${contact.telephone.replace(/\s/g, "")}`}>
          <Button variant="outline" size="sm">
            {contact.telephone}
          </Button>
        </a>
      ) : null}
      {contact.email ? (
        <a href={`mailto:${contact.email}?subject=${encodeURIComponent(sujet)}`}>
          <Button variant="outline" size="sm">
            {contact.email}
          </Button>
        </a>
      ) : null}
    </div>
  );
}

/** Lien WhatsApp vers le numéro publié, avec un message pré-rempli. `null` si aucun numéro. */
export function lienWhatsapp(contact: ContactCommercial, message: string): string | null {
  if (!contact.whatsappNumero) return null;
  return `https://wa.me/${contact.whatsappNumero}?text=${encodeURIComponent(message)}`;
}
