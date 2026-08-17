import type { Metadata } from "next";
import { LegalLayout } from "@/components/public/legal-layout";

export const metadata: Metadata = {
  title: "Cookies et stockage local — NzilaBiz",
  description:
    "Les cookies et le stockage local utilisés par NzilaBiz : à quoi ils servent et combien de temps ils durent.",
};

export default function CookiesPage() {
  return (
    <LegalLayout
      titre="Cookies et stockage local"
      miseAJour="14 août 2026"
      intro="NzilaBiz n'utilise aucun cookie publicitaire ni traceur tiers. Tout ce qui est stocké sur votre appareil sert à faire fonctionner l'application — voici la liste complète."
    >
      <section>
        <h2>Cookies</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-3 font-bold">Nom</th>
              <th className="py-2 pr-3 font-bold">Rôle</th>
              <th className="py-2 font-bold">Durée</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border">
              <td className="py-2 pr-3 font-mono text-xs">nzilabiz_session</td>
              <td className="py-2 pr-3">
                Vous maintient connecté. Signé et inaccessible au code JavaScript de la page.
              </td>
              <td className="py-2">30 jours</td>
            </tr>
          </tbody>
        </table>
        <p>
          Ce cookie est strictement nécessaire : sans lui, impossible de rester connecté. Il ne requiert
          donc pas de consentement préalable, et le refuser reviendrait à ne pas pouvoir utiliser le
          service.
        </p>
      </section>

      <section>
        <h2>Stockage local du navigateur</h2>
        <p>
          Le reste des informations conservées sur votre appareil ne passe pas par des cookies mais par le
          stockage du navigateur. Rien n&apos;en est transmis à un tiers.
        </p>
        <ul>
          <li>
            <strong>Base hors connexion</strong> (IndexedDB) — copie de votre catalogue et des ventes
            réalisées sans réseau, en attente de synchronisation. C&apos;est ce qui permet de continuer à
            encaisser pendant une coupure.
          </li>
          <li>
            <strong>Préférences d&apos;affichage</strong> — thème clair ou sombre, langue de l&apos;interface,
            menu latéral replié ou déplié.
          </li>
        </ul>
        <p>
          <strong>Attention :</strong> effacer les données de navigation ou désinstaller l&apos;application
          supprime aussi les ventes hors connexion pas encore synchronisées. Vérifiez l&apos;écran
          Synchronisation avant de le faire.
        </p>
      </section>

      <section>
        <h2>Services tiers</h2>
        <p>
          Aucun script publicitaire, aucune mesure d&apos;audience, aucun réseau social intégré. Si vous
          choisissez de vous connecter avec Google, Google reçoit la demande d&apos;authentification —
          uniquement à ce moment-là, et uniquement pour vérifier votre identité.
        </p>
      </section>

      <section>
        <h2>Comment les effacer</h2>
        <p>
          Vous pouvez supprimer cookies et stockage local depuis les réglages de votre navigateur. Vous
          serez alors déconnecté, et les données hors connexion non synchronisées seront perdues.
        </p>
      </section>
    </LegalLayout>
  );
}
