import type { Metadata } from "next";
import {
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
import { BackToTop, ScrollProgress } from "@/components/public/scroll-helpers";
import { BoutonCta } from "@/components/public/bouton-cta";
import { getPlatformSettings, contactCommercial } from "@/lib/platform-settings";
import { lireTarifs } from "@/lib/tarifs-serveur";

export const metadata: Metadata = {
  title: "NzilaBiz — La gestion de boutique qui marche même sans réseau",
  description:
    "Caisse, stock, créances, clients fidèles et rapports pour les commerçants d'Afrique centrale. Fonctionne hors connexion, en FCFA, sur téléphone comme sur ordinateur. 15 jours d'essai gratuit.",
};

// Cartes de fonctionnalités : dans la refonte éditoriale, la carte n'est qu'un aplat coloré qui
// porte le picto ; le titre et le texte vivent en dessous, sur le blanc. Les aplats alternent
// encre et vert, comme dans la référence.
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
    texte:
      "Accès complet : chiffres, rapports, paramètres, gestion des employés, validation des annulations.",
  },
  {
    titre: "Gérant",
    texte:
      "Gestion quotidienne : caisse, stock, créances, dépenses et documents, sans les réglages sensibles.",
  },
  {
    titre: "Vendeur",
    texte:
      "Caisse et ses propres ventes uniquement. Une annulation demande la validation du patron.",
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


// Pastille d'amorce au-dessus d'un titre de section : un repère de lecture, pas un niveau de
// titre. Reprend la pastille grise centrée de la référence.
function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </span>
  );
}

// Intro de section centrée : étiquette + titre serif + accroche. Le motif éditorial de la
// référence — tout est aligné au centre, le titre respire.
function IntroSection({
  etiquette,
  titre,
  accroche,
}: {
  etiquette: string;
  titre: React.ReactNode;
  accroche?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <Etiquette>{etiquette}</Etiquette>
      <h2 className="titre-serif mt-5 text-4xl sm:text-[2.75rem]">{titre}</h2>
      {accroche ? <p className="mt-4 text-base text-muted-foreground">{accroche}</p> : null}
    </Reveal>
  );
}

export default async function VitrinePage() {
  const contact = contactCommercial(await getPlatformSettings());
  // Enchaînée, jamais en parallèle : le pooler en mode transaction ne rend pas la main quand
  // plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  const grille = await lireTarifs();

  return (
    <>
      <ScrollProgress />
      <BackToTop />

      {/* Hero ------------------------------------------------------------- */}
      <section className="px-3 pt-4 sm:px-4">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[2rem] bg-encre text-encre-foreground">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
            style={{ animation: "floatSoft 10s ease-in-out infinite" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-48 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
            style={{ animation: "floatSoft 12s ease-in-out infinite reverse" }}
          />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                <WifiOff size={13} /> Fonctionne sans réseau
              </span>
              <h1 className="titre-serif mt-6 text-5xl sm:text-6xl lg:text-[4.25rem]">
                Gérez votre <span className="text-primary">boutique</span>, sans prise de tête
              </h1>
              <p className="mt-6 max-w-xl text-lg text-white/70">
                Caisse, stock, crédits clients, dépenses et rapports — en FCFA, sur votre téléphone,
                même quand la connexion coupe. Pensé pour les commerçants d&apos;Afrique centrale.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <BoutonCta href="/inscription" ton="clair" taille="lg">
                  Essayer 15 jours gratuitement
                </BoutonCta>
                <span className="text-sm text-white/55">Sans carte bancaire. Sans engagement.</span>
              </div>

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-3 text-center">
                {[
                  { valeur: 11, suffixe: "", libelle: "modules métier" },
                  { valeur: 100, suffixe: " %", libelle: "utilisable hors ligne" },
                  { valeur: 3, suffixe: "", libelle: "rôles d'utilisateur" },
                ].map((s) => (
                  <div key={s.libelle} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <dt className="titre-serif text-3xl tabular-nums">
                      <AnimatedCounter value={s.valeur} suffix={s.suffixe} />
                    </dt>
                    <dd className="mt-1 text-xs text-white/55">{s.libelle}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={150} className="mx-auto w-full max-w-md lg:max-w-none">
              <AppPreview />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Problème → solution ---------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <IntroSection
          etiquette="Le constat"
          titre={<>Ce que vous vivez tous les jours</>}
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
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
              <div className="h-full rounded-[1.5rem] bg-card p-7 shadow-carte transition-shadow hover:shadow-relief">
                <h3 className="titre-serif text-xl">{p.titre}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <div className="mt-8 rounded-[1.5rem] bg-encre p-9 text-center text-encre-foreground">
            <p className="titre-serif mx-auto max-w-2xl text-2xl sm:text-[1.75rem]">
              NzilaBiz fait le travail à votre place : vous encaissez,{" "}
              <span className="text-primary">l&apos;application tient les comptes.</span>
            </p>
          </div>
        </Reveal>
      </section>

      {/* Fonctionnalités --------------------------------------------------- */}
      <section id="fonctionnalites" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <IntroSection
          etiquette="Fonctionnalités"
          titre={<>Tout ce dont une boutique a besoin</>}
          accroche="Pas de fonctionnalité décorative : chaque écran répond à une question que vous vous posez réellement dans la journée."
        />

        <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ icon: Icone, titre, texte }, i) => (
            <Reveal key={titre} delay={(i % 4) * 80}>
              <div className="group">
                <div
                  className={`flex aspect-square items-center justify-center rounded-[1.6rem] transition-transform duration-300 group-hover:-translate-y-1 ${
                    i % 2 === 0
                      ? "bg-encre text-white"
                      : "bg-gradient-to-br from-primary to-[#0c7d45] text-white"
                  }`}
                >
                  <Icone size={44} strokeWidth={1.5} />
                </div>
                <h3 className="titre-serif mt-5 text-xl">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texte}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Hors ligne + Mobile Money — deux mises en avant en bandeau ------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <IntroSection
          etiquette="Le détail qui compte"
          titre={<>Deux automatismes qui changent le quotidien</>}
        />

        <div className="mt-14 space-y-8">
          <Reveal>
            <div className="grid items-center gap-8 rounded-[2rem] bg-encre p-7 text-encre-foreground sm:p-10 lg:grid-cols-2">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <WifiOff size={22} />
                </span>
                <h3 className="titre-serif mt-5 text-3xl">
                  La coupure de réseau n&apos;arrête pas la vente
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Les ventes enregistrées hors connexion sont stockées sur l&apos;appareil et
                  remontent automatiquement dès le retour du réseau. Vous voyez à tout moment ce qui
                  reste à synchroniser — rien ne se perd en silence.
                </p>
              </div>
              <div className="rounded-[1.4rem] bg-white/5 p-5 ring-1 ring-white/10">
                <div className="space-y-2.5">
                  {[
                    { t: "Vente V-0148 · 46 000 FCFA", s: "Synchronisée", ok: true },
                    { t: "Vente V-0149 · 12 500 FCFA", s: "Synchronisée", ok: true },
                    { t: "Vente V-0150 · 8 000 FCFA", s: "En attente de réseau", ok: false },
                  ].map((r) => (
                    <div
                      key={r.t}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-xs"
                    >
                      <span className="font-semibold text-white/90">{r.t}</span>
                      <span
                        className={
                          r.ok
                            ? "rounded-full bg-primary/20 px-2 py-0.5 font-bold text-primary"
                            : "rounded-full bg-white/10 px-2 py-0.5 font-bold text-white/60"
                        }
                      >
                        {r.s}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="grid items-center gap-8 rounded-[2rem] bg-gradient-to-br from-primary to-[#0b6e3d] p-7 text-white sm:p-10 lg:grid-cols-2">
              <div className="order-2 rounded-[1.4rem] bg-white/10 p-5 ring-1 ring-white/15 lg:order-1">
                <div className="space-y-2.5">
                  {[
                    { m: "Airtel Money", r: "Réf. AM-7742", v: "25 000" },
                    { m: "Moov Money", r: "Réf. MM-1108", v: "9 500" },
                    { m: "Espèces", r: "Caisse", v: "14 000" },
                  ].map((r) => (
                    <div
                      key={r.m}
                      className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-xs"
                    >
                      <span>
                        <span className="font-bold">{r.m}</span>
                        <span className="ml-2 text-white/60">{r.r}</span>
                      </span>
                      <span className="font-extrabold tabular-nums">{r.v} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white">
                  <Smartphone size={22} />
                </span>
                <h3 className="titre-serif mt-5 text-3xl">Airtel Money et Moov Money</h3>
                <p className="mt-4 text-sm leading-relaxed text-white/80">
                  Enregistrez vos encaissements Mobile Money avec leur référence, à côté des espèces
                  et du crédit, pour un point de caisse juste en fin de journée. La configuration des
                  opérateurs est partagée par toute la boutique.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Démarrage ---------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <IntroSection etiquette="Mise en route" titre={<>Opérationnel le jour même</>} />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {ETAPES.map((e, i) => (
            <Reveal key={e.numero} delay={i * 120}>
              <div className="h-full rounded-[1.5rem] bg-card p-8 shadow-carte">
                <span className="titre-serif flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
                  {e.numero}
                </span>
                <h3 className="titre-serif mt-5 text-xl">{e.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Rôles -------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <IntroSection
          etiquette="Équipe"
          titre={<>Chacun voit ce qui le concerne</>}
          accroche="Vos vendeurs encaissent sans avoir accès à vos marges ni à vos rapports."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.titre} delay={i * 100}>
              <div className="h-full rounded-[1.5rem] bg-card p-7 shadow-carte transition-all duration-300 hover:-translate-y-1 hover:shadow-relief">
                <h3 className="titre-serif text-xl">{r.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.texte}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tarifs ------------------------------------------------------------- */}
      <section id="tarifs" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <IntroSection
          etiquette="Tarifs"
          titre={<>Des formules claires</>}
          accroche="15 jours pour essayer, sans carte bancaire et avec toutes les fonctionnalités. Ensuite, deux formules selon vos besoins — et une troisième si vous gérez plusieurs boutiques."
        />
        <Reveal>
          <Pricing contact={contact} grille={grille} />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Les paiements par Mobile Money sont en cours de mise en service : en attendant,
            l&apos;équipe NzilaBiz vous accompagne par WhatsApp pour activer votre abonnement.
          </p>
        </Reveal>
      </section>

      {/* CTA final — grand mot-symbole serif ------------------------------- */}
      <section className="px-3 pb-6 sm:px-4">
        <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[2rem] bg-encre px-5 py-20 text-center text-encre-foreground sm:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
          />
          <Reveal className="relative">
            <h2 className="titre-serif text-3xl sm:text-4xl">
              Votre boutique mérite mieux qu&apos;un cahier
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/65">
              Créez votre compte, choisissez un catalogue de départ, et encaissez votre première
              vente aujourd&apos;hui.
            </p>
            <div className="mt-9 flex justify-center">
              <BoutonCta href="/inscription" ton="clair" taille="lg">
                Créer ma boutique
              </BoutonCta>
            </div>
            <p
              aria-hidden
              className="titre-serif pointer-events-none mt-14 select-none text-[19vw] leading-none text-white/[0.06] sm:text-[15rem]"
            >
              NzilaBiz
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
