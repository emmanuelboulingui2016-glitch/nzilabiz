import type { Metadata } from "next";
import { AComplete, LegalLayout } from "@/components/public/legal-layout";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Politique de confidentialité — NzilaBiz",
  description:
    "Quelles données NzilaBiz collecte, pourquoi, combien de temps elles sont conservées, et comment exercer vos droits.",
};

// Les informations d'éditeur et d'hébergement viennent des réglages de plateforme.
export default async function ConfidentialitePage() {
  const r = await getPlatformSettings();
  const valeur = (v: string | null, aCompleter: string) => (v ? <>{v}</> : <AComplete>{aCompleter}</AComplete>);
  return (
    <LegalLayout
      titre="Politique de confidentialité"
      miseAJour="14 août 2026"
      intro="Ce document explique quelles données nous traitons, pourquoi, combien de temps nous les gardons et comment vous gardez la main dessus."
    >
      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement est {valeur(r.editeurRaisonSociale, "raison sociale de l'éditeur")}.
          Pour toute question relative à vos données :{" "}
          {r.supportEmail ? <a href={`mailto:${r.supportEmail}`}>{r.supportEmail}</a> : <AComplete>e-mail de contact</AComplete>}.
        </p>
        <p>
          Une précision importante sur les rôles : pour les données de <strong>votre</strong> compte
          d&apos;utilisateur, nous sommes responsables du traitement. Pour les données que vous saisissez
          sur <strong>vos clients</strong>, c&apos;est vous le responsable : nous agissons comme
          sous-traitant technique, sur vos instructions, et n&apos;en faisons aucun usage propre.
        </p>
      </section>

      <section>
        <h2>2. Données que nous traitons</h2>

        <h3>Données de compte</h3>
        <ul>
          <li>nom affiché, adresse e-mail, mot de passe (stocké sous forme chiffrée irréversible) ;</li>
          <li>identifiant Google si vous choisissez ce mode de connexion ;</li>
          <li>rôle dans la boutique, date de création et date de dernière connexion ;</li>
          <li>appareils utilisés pour vous connecter (nom déduit du navigateur, dernière activité).</li>
        </ul>

        <h3>Données de la boutique</h3>
        <ul>
          <li>informations de la boutique : nom, adresse, téléphone, logo, devise ;</li>
          <li>catalogue : produits, prix, stocks, photos ;</li>
          <li>ventes, règlements, documents commerciaux, dépenses ;</li>
          <li>
            fiches clients que vous créez : nom, téléphone, e-mail, adresse, notes, historique
            d&apos;achats et crédits accordés.
          </li>
        </ul>

        <h3>Données techniques</h3>
        <ul>
          <li>
            journaux de synchronisation (date, appareil, résultat), utiles pour diagnostiquer une vente
            qui ne remonte pas ;
          </li>
          <li>
            adresse IP au moment de la connexion, utilisée uniquement pour limiter les tentatives
            d&apos;accès abusives, et non conservée durablement.
          </li>
        </ul>
        <p>
          Nous n&apos;utilisons <strong>aucun outil publicitaire, aucun traceur tiers et aucune mesure
          d&apos;audience externe</strong>. Vos données ne quittent pas le service.
        </p>
      </section>

      <section>
        <h2>3. Pourquoi nous traitons ces données</h2>
        <ul>
          <li>
            <strong>Fournir le service</strong> (base : exécution du contrat) — tenir votre caisse, votre
            stock, vos clients et vos rapports.
          </li>
          <li>
            <strong>Sécuriser les accès</strong> (base : intérêt légitime) — authentification, limitation
            des tentatives de connexion, liste des appareils connectés.
          </li>
          <li>
            <strong>Vous assister</strong> (base : exécution du contrat) — répondre à vos demandes de
            support.
          </li>
          <li>
            <strong>Gérer les abonnements</strong> (bases : contrat et obligations comptables) — suivi des
            paiements et facturation.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Vos données sur vos clients</h2>
        <p>
          Vous êtes libre de créer une fiche client avec le seul nom, ou d&apos;y ajouter téléphone,
          adresse et notes. Rappelez-vous que vos clients ont, eux aussi, des droits sur ces informations :
          n&apos;y consignez que ce qui est utile à votre activité commerciale, et informez-les si vous
          enregistrez leurs coordonnées. Les notes libres ne doivent pas contenir d&apos;informations
          sensibles (santé, opinions, situation familiale).
        </p>
        <p>
          Le classement de fidélité (fidèle, récurrent, inactif…) est calculé automatiquement à partir de
          l&apos;historique d&apos;achats. Il ne produit aucune décision automatisée ayant un effet
          juridique : c&apos;est une aide à la décision, vous restez maître de vos gestes commerciaux.
        </p>
      </section>

      <section>
        <h2>5. Qui a accès aux données</h2>
        <ul>
          <li>
            <strong>Au sein de votre boutique</strong> : selon le rôle. Un vendeur ne voit que la caisse et
            ses propres ventes ; il n&apos;accède ni aux marges, ni aux rapports, ni aux fiches clients.
          </li>
          <li>
            <strong>Entre boutiques</strong> : aucun accès. Chaque boutique est isolée, toutes les requêtes
            sont filtrées côté serveur par son identifiant.
          </li>
          <li>
            <strong>Notre équipe</strong> : accès technique limité aux personnes qui exploitent le service,
            uniquement pour la maintenance ou à votre demande dans le cadre du support.
          </li>
          <li>
            <strong>Sous-traitants</strong> : hébergeur ({valeur(r.hebergeurNom, "hébergeur")}) et, si vous
            utilisez la connexion Google, Google pour la seule vérification de votre identité.
          </li>
        </ul>
        <p>Nous ne vendons ni ne louons vos données à qui que ce soit.</p>
      </section>

      <section>
        <h2>6. Où sont hébergées les données</h2>
        <p>
          Les données sont hébergées chez {valeur(r.hebergeurNom, "hébergeur")}
          {r.hebergeurPays ? <> ({r.hebergeurPays})</> : null}. Une copie de travail réside également sur vos
          propres appareils, pour permettre le fonctionnement hors connexion.
        </p>
      </section>

      <section>
        <h2>7. Combien de temps nous les conservons</h2>
        <ul>
          <li>
            <strong>Tant que votre compte est actif</strong> : les données de la boutique sont conservées
            pour que votre historique reste consultable.
          </li>
          <li>
            <strong>Après expiration de l&apos;abonnement</strong> : 90 jours, le temps de réactiver ou
            d&apos;exporter.
          </li>
          <li>
            <strong>Après suppression du compte par le Patron</strong> : effacement de la boutique et de
            ses données, sauvegardes techniques purgées sous 30 jours.
          </li>
          <li>
            <strong>Après suppression du compte d&apos;un employé</strong> : effacement immédiat de ses
            informations personnelles ; ses ventes restent dans la comptabilité de la boutique, sans son
            nom.
          </li>
          <li>
            <strong>Documents de facturation de l&apos;abonnement</strong> : conservés le temps imposé par
            les obligations comptables applicables.
          </li>
        </ul>
      </section>

      <section>
        <h2>8. Sécurité</h2>
        <ul>
          <li>mots de passe stockés sous forme de condensat (bcrypt), jamais en clair ;</li>
          <li>session transmise dans un cookie inaccessible au code JavaScript, chiffré et signé ;</li>
          <li>chaque requête au serveur revérifie votre identité et vos droits, jamais le navigateur seul ;</li>
          <li>limitation du nombre de tentatives de connexion et de création de compte ;</li>
          <li>en-têtes de sécurité stricts (politique de contenu, protection contre l&apos;encadrement de page).</li>
        </ul>
        <p>
          Aucun système n&apos;est infaillible. En cas de violation de données susceptible d&apos;engendrer
          un risque pour vous, nous vous en informerons sans délai injustifié, avec les mesures à prendre.
        </p>
      </section>

      <section>
        <h2>9. Vos droits</h2>
        <p>Vous pouvez à tout moment :</p>
        <ul>
          <li>
            <strong>consulter et exporter</strong> vos données — les écrans Clients, Stock et Rapports
            proposent un export CSV ou PDF immédiat ;
          </li>
          <li>
            <strong>corriger</strong> vos informations depuis Paramètres → Sécurité et Mon compte ;
          </li>
          <li>
            <strong>supprimer</strong> votre compte depuis Paramètres → Mon compte ;
          </li>
          <li>
            <strong>vous opposer</strong> à un traitement ou en demander la limitation, en nous écrivant.
          </li>
        </ul>
        <p>
          Pour toute demande :{" "}
          {r.supportEmail ? <a href={`mailto:${r.supportEmail}`}>{r.supportEmail}</a> : <AComplete>e-mail de contact</AComplete>}.
          Nous répondons sous 30 jours. Si la réponse ne vous satisfait pas, vous pouvez saisir
          l&apos;autorité de protection des données compétente :{" "}
          {valeur(r.autoriteProtectionDonnees, "autorité compétente")}.
        </p>
      </section>

      <section>
        <h2>10. Cookies</h2>
        <p>
          NzilaBiz n&apos;utilise que des cookies strictement nécessaires à son fonctionnement. Le détail
          figure sur la page <a href="/cookies">Cookies</a>.
        </p>
      </section>

      <section>
        <h2>11. Modifications</h2>
        <p>
          Toute évolution substantielle de cette politique vous sera signalée dans l&apos;application avant
          son entrée en vigueur.
        </p>
      </section>
    </LegalLayout>
  );
}
