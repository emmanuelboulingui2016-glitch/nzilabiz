import type { Metadata } from "next";
import { AComplete, LegalLayout } from "@/components/public/legal-layout";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — NzilaBiz",
  description:
    "Conditions générales d'utilisation du service NzilaBiz : compte, abonnement, données, responsabilités et résiliation.",
};

// Les informations d'éditeur viennent des réglages de plateforme (Administration → Réglages).
export default async function ConditionsPage() {
  const r = await getPlatformSettings();
  const valeur = (v: string | null, aCompleter: string) => (v ? <>{v}</> : <AComplete>{aCompleter}</AComplete>);
  return (
    <LegalLayout
      titre="Conditions générales d'utilisation"
      miseAJour="14 août 2026"
      intro="Ces conditions encadrent l'utilisation de NzilaBiz. En créant un compte, vous les acceptez. Elles sont rédigées pour être lisibles sans formation juridique."
    >
      <section>
        <h2>1. Qui édite le service</h2>
        <p>
          {r.nomApplication} (« le Service ») est édité par {valeur(r.editeurRaisonSociale, "raison sociale de l'éditeur")}, dont les coordonnées complètes figurent dans les{" "}
          <a href="/mentions-legales">mentions légales</a>.
        </p>
      </section>

      <section>
        <h2>2. Objet du service</h2>
        <p>
          NzilaBiz est une application de gestion de boutique : encaissement, suivi de stock, gestion des
          clients et des crédits accordés, suivi des dépenses, édition de documents commerciaux et
          rapports d&apos;activité. Le Service est destiné à un usage professionnel par des commerçants et
          leurs employés.
        </p>
        <p>
          Le Service n&apos;est pas un logiciel de comptabilité certifié et ne remplace pas un expert-comptable.
          Il ne gère ni déclaration fiscale, ni TVA, ni obligation légale de facturation propre à un pays
          donné. Les documents qu&apos;il produit sont des documents commerciaux, dont la conformité aux
          obligations locales relève de votre responsabilité.
        </p>
      </section>

      <section>
        <h2>3. Compte et responsabilité des accès</h2>
        <ul>
          <li>
            La création d&apos;un compte ouvre une boutique dont le créateur devient le <strong>Patron</strong>,
            c&apos;est-à-dire le titulaire des données de cette boutique.
          </li>
          <li>
            Le Patron peut créer des comptes <strong>Gérant</strong> et <strong>Vendeur</strong>. Il est
            responsable des accès qu&apos;il accorde et de leur révocation.
          </li>
          <li>
            Vous vous engagez à fournir des informations exactes, à garder votre mot de passe confidentiel
            et à nous signaler tout accès non autorisé.
          </li>
          <li>
            Toute action réalisée depuis un compte est réputée effectuée par son titulaire.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Essai gratuit et abonnement</h2>
        <ul>
          <li>
            Chaque nouvelle boutique bénéficie d&apos;un essai gratuit de <strong>15 jours</strong>, sans
            moyen de paiement requis, donnant accès à l&apos;ensemble des fonctionnalités.
          </li>
          <li>
            À l&apos;issue de l&apos;essai, la poursuite du Service nécessite un abonnement payant. Les tarifs
            en vigueur sont affichés sur la page d&apos;accueil et dans Paramètres → Abonnement.
          </li>
          <li>
            L&apos;abonnement est payable d&apos;avance pour la période choisie (mensuelle, trimestrielle ou
            annuelle). Il n&apos;est pas reconduit automatiquement sans votre accord.
          </li>
          <li>
            En l&apos;absence d&apos;abonnement actif, l&apos;accès aux fonctionnalités peut être restreint.
            Vos données restent conservées pendant <strong>90 jours</strong> après l&apos;expiration, délai
            pendant lequel vous pouvez les exporter ou réactiver votre abonnement.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Vos données vous appartiennent</h2>
        <p>
          Les données que vous saisissez — produits, ventes, clients, dépenses, documents — restent votre
          propriété. Nous ne les vendons pas, ne les louons pas et ne les exploitons pas à des fins
          publicitaires. Vous pouvez les exporter à tout moment en CSV et en PDF depuis les écrans
          concernés.
        </p>
        <p>
          Le traitement de ces données est décrit dans notre{" "}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </section>

      <section>
        <h2>6. Disponibilité et fonctionnement hors connexion</h2>
        <p>
          Nous mettons tout en œuvre pour assurer la disponibilité du Service, sans pouvoir garantir un
          fonctionnement ininterrompu : maintenance, panne d&apos;hébergement ou coupure du réseau de votre
          opérateur peuvent l&apos;affecter.
        </p>
        <p>
          Le Service est conçu pour rester utilisable hors connexion : les ventes réalisées sans réseau
          sont conservées sur l&apos;appareil et synchronisées au retour de la connexion. Cette
          synchronisation dépend toutefois de la conservation des données par le navigateur de
          l&apos;appareil ; effacer les données du navigateur ou désinstaller l&apos;application avant
          synchronisation peut entraîner leur perte. Il vous appartient de vérifier régulièrement, dans
          l&apos;écran Synchronisation, qu&apos;aucune vente n&apos;est en attente.
        </p>
      </section>

      <section>
        <h2>7. Paiements par Mobile Money</h2>
        <p>
          Les modes de règlement enregistrés dans la caisse (espèces, Mobile Money, crédit) sont des
          <strong> informations de suivi</strong> : le Service enregistre qu&apos;un paiement a eu lieu, il
          n&apos;encaisse pas les fonds à votre place et n&apos;intervient pas dans la transaction entre vous
          et votre client. La mise en service de l&apos;encaissement Mobile Money directement dans
          l&apos;application fera l&apos;objet d&apos;une information dédiée.
        </p>
      </section>

      <section>
        <h2>8. Usage acceptable</h2>
        <p>Vous vous engagez à ne pas :</p>
        <ul>
          <li>utiliser le Service pour une activité illicite ou pour dissimuler des opérations frauduleuses ;</li>
          <li>tenter d&apos;accéder aux données d&apos;une autre boutique que la vôtre ;</li>
          <li>perturber le fonctionnement du Service (surcharge volontaire, contournement des limites techniques) ;</li>
          <li>revendre ou redistribuer l&apos;accès au Service sans notre accord écrit.</li>
        </ul>
        <p>
          En cas de manquement grave, nous pouvons suspendre l&apos;accès après vous en avoir informé, sauf
          urgence (atteinte à la sécurité ou aux données d&apos;autres utilisateurs).
        </p>
      </section>

      <section>
        <h2>9. Responsabilité</h2>
        <p>
          Le Service est fourni en l&apos;état. Nous sommes tenus à une obligation de moyens quant à sa
          disponibilité et à la sécurisation de vos données. Nous ne pouvons être tenus responsables des
          conséquences d&apos;une saisie erronée, d&apos;une décision commerciale prise sur la base des
          rapports, d&apos;une perte de données consécutive à un effacement du navigateur, ni d&apos;un
          manque à gagner.
        </p>
        <p>
          En tout état de cause, notre responsabilité est limitée aux sommes que vous avez effectivement
          versées au titre de l&apos;abonnement au cours des douze mois précédant le fait générateur.
        </p>
      </section>

      <section>
        <h2>10. Résiliation et suppression du compte</h2>
        <ul>
          <li>
            Vous pouvez cesser d&apos;utiliser le Service à tout moment. La suppression du compte
            s&apos;effectue depuis Paramètres → Mon compte.
          </li>
          <li>
            Lorsque le <strong>Patron</strong> supprime son compte, la boutique et l&apos;intégralité de ses
            données sont effacées, y compris les comptes de ses employés. Cette action est irréversible :
            exportez vos données au préalable.
          </li>
          <li>
            Lorsqu&apos;un <strong>Gérant</strong> ou un <strong>Vendeur</strong> supprime son compte, son
            accès est supprimé et ses informations personnelles effacées. Les ventes qu&apos;il a
            enregistrées restent dans l&apos;historique de la boutique, sans son nom : elles appartiennent à
            la comptabilité du commerçant.
          </li>
          <li>Les sommes déjà versées au titre d&apos;une période entamée ne sont pas remboursées.</li>
        </ul>
      </section>

      <section>
        <h2>11. Évolution du service et des conditions</h2>
        <p>
          Le Service évolue : des fonctionnalités peuvent être ajoutées, modifiées ou retirées. En cas de
          modification substantielle de ces conditions, vous en serez informé dans l&apos;application au
          moins 30 jours avant son entrée en vigueur. Continuer à utiliser le Service après cette date vaut
          acceptation.
        </p>
      </section>

      <section>
        <h2>12. Droit applicable et litiges</h2>
        <p>
          Ces conditions sont régies par le droit {valeur(r.droitApplicable, "pays / droit applicable")}. En
          cas de différend, nous privilégions une solution amiable : écrivez-nous à{" "}
          {r.supportEmail ? <a href={`mailto:${r.supportEmail}`}>{r.supportEmail}</a> : <AComplete>e-mail de contact</AComplete>}. À
          défaut d&apos;accord, le litige sera porté devant {valeur(r.juridictionCompetente, "juridiction compétente")}.
        </p>
      </section>
    </LegalLayout>
  );
}
