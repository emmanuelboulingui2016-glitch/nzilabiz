import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LifeBuoy, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPlatformSettings } from "@/lib/platform-settings";

// Les coordonnées du support viennent des réglages : cette page est pré-générée, elle doit donc
// être purgée à leur enregistrement, comme les pages légales.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Mot de passe oublié — NzilaBiz",
  description: "Comment retrouver l'accès à votre compte NzilaBiz.",
};

// Cette page dit la vérité sur ce que le service sait faire aujourd'hui : il n'envoie pas
// d'e-mail, donc il n'y a pas de réinitialisation automatique. Le recours réel passe par le
// Patron, qui est physiquement présent dans la boutique, ou par le support. Un lien mort
// promettant une réinitialisation qui n'existe pas serait pire que cette explication.
export default async function MotDePasseOubliePage() {
  const r = await getPlatformSettings();
  const whatsapp = r.supportWhatsapp ? `https://wa.me/${r.supportWhatsapp.replace(/[^\d]/g, "")}` : null;

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
        <KeyRound size={18} /> Mot de passe oublié
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        NzilaBiz n&apos;envoie pas d&apos;e-mail de réinitialisation. Voici les deux façons de
        retrouver votre accès.
      </p>

      <div className="space-y-3">
        <section className="rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Store size={15} className="text-primary" /> Vous êtes vendeur ou gérant
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Demandez au <strong className="text-foreground">Patron de votre boutique</strong> de vous
            générer un nouveau mot de passe : <em>Paramètres → Utilisateurs</em>, puis le bouton en
            forme de clé en face de votre nom. Il vous le communiquera directement. Changez-le
            ensuite depuis <em>Paramètres → Sécurité</em>.
          </p>
        </section>

        <section className="rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <LifeBuoy size={15} className="text-primary" /> Vous êtes le Patron
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Vous seul détenez l&apos;accès à votre boutique : contactez le support, qui vérifiera
            votre identité avant toute remise en main.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">WhatsApp</Button>
              </a>
            ) : null}
            {r.supportTelephone ? (
              <a href={`tel:${r.supportTelephone.replace(/\s/g, "")}`}>
                <Button variant="outline" size="sm">{r.supportTelephone}</Button>
              </a>
            ) : null}
            {r.supportEmail ? (
              <a href={`mailto:${r.supportEmail}?subject=Mot%20de%20passe%20oubli%C3%A9`}>
                <Button variant="outline" size="sm">{r.supportEmail}</Button>
              </a>
            ) : null}
          </div>
          {!whatsapp && !r.supportTelephone && !r.supportEmail ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Aucun contact de support n&apos;est encore publié.
            </p>
          ) : null}
        </section>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link href="/connexion" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
