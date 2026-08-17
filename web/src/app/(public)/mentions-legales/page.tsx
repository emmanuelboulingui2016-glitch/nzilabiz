import type { Metadata } from "next";
import { AComplete, LegalLayout } from "@/components/public/legal-layout";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Mentions légales — NzilaBiz",
  description: "Éditeur, hébergeur et contact du service NzilaBiz.",
};

// Les informations d'éditeur viennent des réglages de plateforme (Administration → Réglages) :
// elles se corrigent sans toucher au code. Tant qu'un champ n'est pas renseigné, la page affiche
// un « à compléter » visible plutôt qu'une mention inventée.
export default async function MentionsLegalesPage() {
  const r = await getPlatformSettings();

  const valeur = (v: string | null, aCompleter: string) =>
    v ? <>{v}</> : <AComplete>{aCompleter}</AComplete>;

  return (
    <LegalLayout
      titre="Mentions légales"
      miseAJour="14 août 2026"
      intro="Les informations ci-dessous identifient l'éditeur et l'hébergeur du service."
    >
      <section>
        <h2>Éditeur du service</h2>
        <ul>
          <li>Dénomination : {valeur(r.editeurRaisonSociale, "raison sociale")}</li>
          <li>
            Forme juridique et capital : {valeur(r.editeurFormeJuridique, "forme juridique, capital social")}
          </li>
          <li>Siège social : {valeur(r.editeurAdresse, "adresse complète")}</li>
          <li>
            Numéro d&apos;immatriculation :{" "}
            {valeur(r.editeurImmatriculation, "numéro d'immatriculation au registre du commerce")}
          </li>
          <li>
            Directeur de la publication :{" "}
            {valeur(r.editeurDirecteurPublication, "nom du responsable de publication")}
          </li>
          <li>
            Contact :{" "}
            {r.supportEmail ? (
              <a href={`mailto:${r.supportEmail}`}>{r.supportEmail}</a>
            ) : (
              <AComplete>e-mail de contact</AComplete>
            )}
            {r.supportTelephone ? <> — {r.supportTelephone}</> : null}
          </li>
        </ul>
      </section>

      <section>
        <h2>Hébergement</h2>
        <ul>
          <li>Hébergeur : {valeur(r.hebergeurNom, "nom de l'hébergeur")}</li>
          <li>Adresse : {valeur(r.hebergeurAdresse, "adresse de l'hébergeur")}</li>
          <li>Pays d&apos;hébergement des données : {valeur(r.hebergeurPays, "pays")}</li>
        </ul>
      </section>

      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          La marque {r.nomApplication}, son logo, l&apos;interface du service et son code source sont
          protégés. Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite
          préalable est interdite. Les données que vous saisissez dans le service restent votre propriété.
        </p>
      </section>

      <section>
        <h2>Signaler un problème</h2>
        <p>
          Pour signaler un contenu illicite, une faille de sécurité ou toute autre difficulté, écrivez à{" "}
          {r.supportEmail ? (
            <a href={`mailto:${r.supportEmail}`}>{r.supportEmail}</a>
          ) : (
            <AComplete>e-mail de contact</AComplete>
          )}
          . Les signalements de sécurité sont traités en priorité ; merci de ne pas les rendre publics
          avant que nous ayons pu corriger.
        </p>
      </section>

      <section>
        <h2>Documents liés</h2>
        <ul>
          <li>
            <a href="/conditions">Conditions générales d&apos;utilisation</a>
          </li>
          <li>
            <a href="/confidentialite">Politique de confidentialité</a>
          </li>
          <li>
            <a href="/cookies">Cookies et stockage local</a>
          </li>
        </ul>
      </section>
    </LegalLayout>
  );
}
