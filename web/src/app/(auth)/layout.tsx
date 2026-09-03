import Image from "next/image";
import Link from "next/link";
import { CloudOff, HandCoins, Package } from "lucide-react";

/**
 * Écrans de connexion et d'inscription — mise en page en deux volets.
 *
 * `theme-clair` force les jetons clairs, comme sur la vitrine : ces pages ne suivent jamais le
 * mode sombre du système. Un commerçant qui découvre le produit doit le voir tel qu'il a été
 * dessiné, et le panneau d'encre du volet gauche perd tout contraste sur un fond déjà sombre.
 * C'est du CSS, pas un retrait de classe en JavaScript : rien ne clignote au chargement.
 *
 * Le volet gauche disparaît sous 1024 px, et ce n'est pas un repli : la plupart des commerçants
 * s'inscrivent depuis leur téléphone. C'est la vue étroite qui est la vue principale — d'où le
 * logo remonté au-dessus du formulaire dès que le panneau latéral n'est plus là.
 */
const ARGUMENTS = [
  { Icone: CloudOff, texte: "Encaissez même quand la connexion coupe" },
  { Icone: Package, texte: "Stock et alertes de rupture à jour" },
  { Icone: HandCoins, texte: "Créances clients suivies au franc près" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-clair flex min-h-dvh bg-background text-foreground">
      {/* Volet gauche : il vend, il ne demande rien.
          `isolate` referme une nouvelle scène d'empilement locale : les deux calques décoratifs
          ci-dessous, en z négatif, restent ainsi coincés entre le fond bg-encre et le texte —
          sans `isolate`, un z-index négatif remonterait jusqu'au fond de page et disparaîtrait
          derrière le <body>. */}
      <aside className="relative isolate hidden w-[44%] max-w-2xl flex-col justify-between overflow-hidden bg-encre p-12 text-encre-foreground lg:flex">
        {/* Icône de marque en filigrane : grand format, ancrée dans l'angle bas-droit et
            débordant volontairement du cadre (`overflow-hidden` sur l'aside la rogne proprement).
            L'opacité est le réglage délicat : à 10 % sur un fond quasi noir, la marque ne se
            voyait pas du tout — autant ne rien mettre. À 22 %, elle se lit comme un filigrane
            assumé, et le dégradé ci-dessous protège la zone où tombe le texte. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 -z-20 aspect-square w-[82%] max-w-[32rem] opacity-[0.22]"
        >
          <Image
            src="/brand/nzilabiz-icone-transparent.png"
            alt=""
            fill
            sizes="32rem"
            className="object-contain"
          />
        </div>

        {/* Dégradé d'encre par-dessus le filigrane : concentré sur l'angle où vit l'icône (bas
            droit — là où tombent aussi les arguments et la mention de bas), il rétablit un
            contraste confortable sans assombrir le reste du panneau. Couleur reprise du jeton
            --color-encre, jamais de hex en dur. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_100%_100%,var(--color-encre)_0%,transparent_60%)]"
        />

        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/nzilabiz-icone-transparent.png" alt="" width={44} height={44} />
          <span className="text-2xl font-extrabold">NzilaBiz</span>
        </Link>

        <div className="animate-[slideIn_.5s_ease-out_both]">
          <p className="text-3xl font-extrabold leading-tight sm:text-4xl">
            La gestion de boutique
            <br />
            qui tient dans une poche.
          </p>
          <p className="mt-4 max-w-md text-sm text-encre-foreground/70">
            Caisse, stock, crédits clients et rapports — en FCFA, pensés pour les commerçants
            d&apos;Afrique centrale.
          </p>

          <ul className="mt-8 space-y-3">
            {ARGUMENTS.map(({ Icone, texte }, i) => (
              <li
                key={texte}
                className="flex items-center gap-3 text-sm text-encre-foreground/85"
                style={{ animation: `slideIn .45s ease-out ${180 + i * 90}ms both` }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icone size={16} aria-hidden="true" />
                </span>
                {texte}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-encre-foreground/50">15 jours d&apos;essai. Sans carte bancaire.</p>
      </aside>

      {/* Volet droit : le formulaire, et rien d'autre. */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-[slideIn_.4s_ease-out_both]">
          <Link href="/" className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <Image src="/brand/nzilabiz-icone-transparent.png" alt="NzilaBiz" width={52} height={52} />
            <span className="text-xl font-extrabold">NzilaBiz</span>
          </Link>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-carte sm:p-8">{children}</div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/conditions" className="hover:text-foreground">
              Conditions
            </Link>
            {" · "}
            <Link href="/confidentialite" className="hover:text-foreground">
              Confidentialité
            </Link>
            {" · "}
            <Link href="/mentions-legales" className="hover:text-foreground">
              Mentions légales
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
