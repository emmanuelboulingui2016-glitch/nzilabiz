import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  FileText,
  HandCoins,
  Package,
  RefreshCw,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
  WifiOff,
} from "lucide-react";
import { Reveal } from "@/components/public/reveal";
import { AnimatedCounter } from "@/components/public/animated-counter";
import { AppPreview } from "@/components/public/app-preview";
import { Pricing } from "@/components/public/pricing";
import { Faq } from "@/components/public/faq";
import { BackToTop, ScrollProgress } from "@/components/public/scroll-helpers";

export const metadata: Metadata = {
  title: "NzilaBiz — La gestion de boutique qui marche même sans réseau",
  description:
    "Caisse, stock, créances, clients fidèles et rapports pour les commerçants d'Afrique centrale. Fonctionne hors connexion, en FCFA, sur téléphone comme sur ordinateur. 15 jours d'essai gratuit.",
};

const MODULES = [
  {
    icon: ShoppingCart,
    titre: "Caisse rapide",
    texte:
      "Encaissez en quelques secondes : recherche produit, scan de code-barres, espèces, Mobile Money, crédit ou paiement mixte, avec la monnaie à rendre calculée.",
  },
  {
    icon: Package,
    titre: "Stock toujours juste",
    texte:
      "Le stock se décrémente à chaque vente. Réception de livraison en un seul flux, alertes de seuil bas et de péremption, inventaire et ajustements tracés.",
  },
  {
    icon: Users,
    titre: "Clients fidèles",
    texte:
      "Chaque client est classé automatiquement — fidèle, récurrent, nouveau, inactif — d'après ses achats. Vous savez qui fait vivre la boutique et qui n'est plus revenu.",
  },
  {
    icon: HandCoins,
    titre: "Créances sous contrôle",
    texte:
      "Qui vous doit quoi, depuis combien de jours, avec limite de crédit par client et relance WhatsApp en un clic.",
  },
  {
    icon: Wallet,
    titre: "Dépenses et bénéfice",
    texte:
      "Enregistrez achats de stock, loyer, salaires, transport. Le bénéfice net se calcule tout seul, sans tableur.",
  },
  {
    icon: FileText,
    titre: "Factures et proformas",
    texte:
      "Reçus, factures et devis professionnels en PDF, partageables par WhatsApp, avec votre logo et vos coordonnées.",
  },
  {
    icon: BarChart3,
    titre: "Rapports clairs",
    texte:
      "Chiffre d'affaires, marge, produits qui marchent, heures de pointe. Exportables en PDF ou CSV pour votre comptable.",
  },
  {
    icon: RefreshCw,
    titre: "Plusieurs appareils",
    texte:
      "Le patron sur son téléphone, le vendeur sur la tablette de la boutique : tout le monde voit les mêmes chiffres.",
  },
];

const ROLES = [
  {
    titre: "Patron",
    texte: "Accès complet : chiffres, rapports, paramètres, gestion des employés, validation des annulations.",
  },
  {
    titre: "Gérant",
    texte: "Gestion quotidienne : caisse, stock, créances, dépenses et documents, sans les réglages sensibles.",
  },
  {
    titre: "Vendeur",
    texte: "Caisse et ses propres ventes uniquement. Une annulation demande la validation du patron.",
  },
];

const ETAPES = [
  {
    numero: "1",
    titre: "Créez votre boutique",
    texte: "Nom, ville, type de commerce. Une minute, sans carte bancaire.",
  },
  {
    numero: "2",
    titre: "Partez d'un catalogue prêt",
    texte: "Choisissez le modèle proche de votre activité, ajustez vos prix et vos quantités.",
  },
  {
    numero: "3",
    titre: "Encaissez",
    texte: "Le stock, les crédits et les rapports se remplissent tout seuls, vente après vente.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Est-ce que ça marche vraiment sans internet ?",
    reponse:
      "Oui. Les ventes, le stock et les clients restent utilisables hors connexion : tout est enregistré sur l'appareil, puis synchronisé automatiquement dès que le réseau revient. C'est le cas d'usage pour lequel NzilaBiz a été conçu.",
  },
  {
    question: "Faut-il un ordinateur ?",
    reponse:
      "Non. NzilaBiz s'installe sur un téléphone Android comme une application, depuis le navigateur, sans passer par un magasin d'applications. Ça marche aussi sur tablette et sur ordinateur.",
  },
  {
    question: "Mes données m'appartiennent-elles ?",
    reponse:
      "Oui. Vous exportez à tout moment vos produits, clients, ventes et rapports en CSV ou PDF. Si vous supprimez votre compte, la boutique et ses données sont effacées.",
  },
  {
    question: "Est-ce adapté à une boutique qui vend à crédit ?",
    reponse:
      "C'est prévu pour. Chaque client peut avoir sa limite de crédit et son délai de paiement, et l'application vous signale les retards avant qu'ils ne deviennent des pertes.",
  },
  {
    question: "Mes vendeurs verront-ils mes marges ?",
    reponse:
      "Non. Un vendeur accède à la caisse et à ses propres ventes, rien d'autre : ni les marges, ni les rapports, ni les fiches clients. C'est vous qui décidez du rôle de chacun.",
  },
  {
    question: "Combien de temps pour démarrer ?",
    reponse:
      "Une quinzaine de minutes : vous créez votre boutique, choisissez un modèle de catalogue proche de votre activité, ajustez vos prix, et vous pouvez encaisser.",
  },
];

export default function VitrinePage() {
  return (
    <>
      <ScrollProgress />
      <BackToTop />

      {/* Hero ------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        {/* Halos décoratifs : donnent de la profondeur sans image à charger. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
          style={{ animation: "floatSoft 9s ease-in-out infinite" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
          style={{ animation: "floatSoft 11s ease-in-out infinite reverse" }}
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <WifiOff size={13} /> Fonctionne sans réseau
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Gérez votre boutique, simplement, au quotidien
            </h1>
            <p className="mt-4 max-w-xl text-lg text-sidebar-muted">
              Caisse, stock, crédits clients, dépenses et rapports — en FCFA, sur votre téléphone, même
              quand la connexion coupe. Pensé pour les commerçants d&apos;Afrique centrale.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/inscription"
                className="group inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-bold text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/25"
              >
                Essayer 15 jours gratuitement
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/connexion"
                className="inline-flex h-12 items-center rounded-lg border border-white/25 px-6 text-base font-bold transition-colors hover:bg-white/10"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>
            <p className="mt-3 text-sm text-sidebar-muted">Sans carte bancaire. Sans engagement.</p>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-3 text-center">
              {[
                { valeur: 11, suffixe: "", libelle: "modules métier" },
                { valeur: 100, suffixe: " %", libelle: "utilisable hors ligne" },
                { valeur: 3, suffixe: "", libelle: "rôles d'utilisateur" },
              ].map((s) => (
                <div key={s.libelle} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                  <dt className="text-2xl font-extrabold tabular-nums">
                    <AnimatedCounter value={s.valeur} suffix={s.suffixe} />
                  </dt>
                  <dd className="text-xs text-sidebar-muted">{s.libelle}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={150} className="mx-auto w-full max-w-md lg:max-w-none">
            <AppPreview />
          </Reveal>
        </div>
      </section>

      {/* Problème → solution ---------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              titre: "Le cahier ne suit plus",
              texte:
                "Ventes notées à la va-vite, stock jamais à jour, crédits oubliés : à la fin du mois, impossible de dire ce que la boutique a réellement gagné.",
            },
            {
              titre: "Le réseau n'est pas fiable",
              texte:
                "La plupart des logiciels s'arrêtent dès que la connexion coupe. En pleine journée de marché, c'est inutilisable.",
            },
            {
              titre: "Les outils ne parlent pas votre langue",
              texte:
                "Devises étrangères, TVA qui ne vous concerne pas, notions comptables inutiles : vous perdez du temps à contourner l'outil.",
            },
          ].map((p, i) => (
            <Reveal key={p.titre} delay={i * 100}>
              <div className="h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                <h3 className="text-base font-bold">{p.titre}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
            <p className="text-lg font-bold">
              NzilaBiz fait le travail à votre place : vous encaissez, l&apos;application tient les comptes.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Fonctionnalités --------------------------------------------------- */}
      <section id="fonctionnalites" className="border-y border-border bg-card py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight">Tout ce dont une boutique a besoin</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Pas de fonctionnalité décorative : chaque écran répond à une question que vous vous posez
              réellement dans la journée.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icone, titre, texte }, i) => (
              <Reveal key={titre} delay={(i % 4) * 80}>
                <div className="group h-full rounded-xl border border-border bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icone size={20} />
                  </span>
                  <h3 className="mt-3 text-base font-bold">{titre}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{texte}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Hors ligne + Mobile Money ----------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <WifiOff size={20} />
              </span>
              <h3 className="mt-3 text-xl font-bold">La coupure de réseau n&apos;arrête pas la vente</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Les ventes enregistrées hors connexion sont stockées sur l&apos;appareil et remontent
                automatiquement dès le retour du réseau. Vous voyez à tout moment ce qui reste à
                synchroniser — rien ne se perd en silence.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Smartphone size={20} />
              </span>
              <h3 className="mt-3 text-xl font-bold">Airtel Money et Moov Money</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Enregistrez vos encaissements Mobile Money avec leur référence, à côté des espèces et du
                crédit, pour un point de caisse juste en fin de journée. La configuration des opérateurs
                est partagée par toute la boutique.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Démarrage ---------------------------------------------------------- */}
      <section className="border-y border-border bg-card py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight">Opérationnel le jour même</h2>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {ETAPES.map((e, i) => (
              <Reveal key={e.numero} delay={i * 120}>
                <div className="relative h-full rounded-xl border border-border bg-background p-5">
                  <span className="absolute -top-4 left-5 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-extrabold text-primary-foreground shadow">
                    {e.numero}
                  </span>
                  <h3 className="mt-4 text-base font-bold">{e.titre}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{e.texte}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Rôles -------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-tight">Chacun voit ce qui le concerne</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Vos vendeurs encaissent sans avoir accès à vos marges ni à vos rapports.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.titre} delay={i * 100}>
              <div className="h-full rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <h3 className="text-base font-bold">{r.titre}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tarifs ------------------------------------------------------------- */}
      <section id="tarifs" className="border-y border-border bg-card py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight">Un prix simple</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              15 jours pour essayer, sans carte bancaire. Ensuite, un abonnement unique qui donne accès à
              tout, pour toute votre équipe.
            </p>
            <Pricing />
            <p className="mt-4 text-xs text-muted-foreground">
              Les paiements par Mobile Money sont en cours de mise en service : en attendant, l&apos;équipe
              NzilaBiz vous accompagne par WhatsApp pour activer votre abonnement.
            </p>
          </Reveal>
        </div>
      </section>

      {/* FAQ ---------------------------------------------------------------- */}
      <section id="faq" className="mx-auto w-full max-w-3xl px-4 py-16">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-tight">Questions fréquentes</h2>
          <Faq items={FAQ_ITEMS} />
        </Reveal>
      </section>

      {/* CTA final ----------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-sidebar py-16 text-sidebar-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-3xl px-4 text-center">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Votre boutique mérite mieux qu&apos;un cahier
            </h2>
            <p className="mt-3 text-sidebar-muted">
              Créez votre compte, choisissez un catalogue de départ, et encaissez votre première vente
              aujourd&apos;hui.
            </p>
            <Link
              href="/inscription"
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-bold text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/25"
            >
              Créer ma boutique
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
