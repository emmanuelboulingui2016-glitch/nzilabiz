import Link from "next/link";
import Image from "next/image";
import { PublicHeader } from "@/components/public/public-header";
import { getPlatformSettings } from "@/lib/platform-settings";

// Layout des pages publiques (vitrine et pages légales) : accessibles sans compte, donc sans
// aucun appel à la session.
//
// Ces pages sont pré-générées pour rester rapides, mais elles affichent des réglages modifiables
// depuis l'administration. L'enregistrement des réglages purge leur cache ; ce rafraîchissement
// horaire n'est qu'un filet de sécurité, au cas où une modification passerait par un autre chemin.
export const revalidate = 3600;
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const r = await getPlatformSettings();
  return (
    <div className="vitrine-claire cadre-vitrine flex min-h-dvh flex-col bg-background text-foreground">
      <PublicHeader />

      <main className="flex-1">{children}</main>

      {/* Le fond blanc (bg-card) sur le presque-blanc du corps de page suffit à marquer la coupure :
          une bordure aurait doublé l'effet pour rien, alors que la charte demande moins de traits. */}
      <footer className="bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:py-16">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/brand/nzilabiz-icone-transparent.png" alt="" width={36} height={36} className="shrink-0" />
              <span className="font-serif text-2xl font-semibold">{r.nomApplication}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              La gestion de boutique pensée pour les commerçants d&apos;Afrique centrale. Caisse, stock,
              créances et rapports — même sans réseau.
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-extrabold">Produit</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/#fonctionnalites" className="hover:text-foreground">
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link href="/#tarifs" className="hover:text-foreground">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-foreground">
                  Questions fréquentes
                </Link>
              </li>
              <li>
                <Link href="/inscription" className="hover:text-foreground">
                  Créer une boutique
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-extrabold">Légal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/conditions" className="hover:text-foreground">
                  Conditions d&apos;utilisation
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="hover:text-foreground">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-foreground">
                  Cookies
                </Link>
              </li>
              <li>
                <Link href="/mentions-legales" className="hover:text-foreground">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-sm font-extrabold">Contact</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {r.supportEmail ? (
                <li>
                  <a href={`mailto:${r.supportEmail}`} className="hover:text-foreground">
                    {r.supportEmail}
                  </a>
                </li>
              ) : null}
              {r.supportWhatsapp ? (
                <li>
                  <a href={`https://wa.me/${r.supportWhatsapp.replace(/[^0-9]/g, "")}`} className="hover:text-foreground">
                    Support WhatsApp
                  </a>
                </li>
              ) : null}
              {r.supportTelephone ? <li>{r.supportTelephone}</li> : null}
              {r.supportHoraires ? <li>{r.supportHoraires}</li> : null}
              {r.editeurAdresse ? <li>{r.editeurAdresse}</li> : null}
              {[
                { url: r.facebookUrl, nom: "Facebook" },
                { url: r.instagramUrl, nom: "Instagram" },
                { url: r.tiktokUrl, nom: "TikTok" },
              ]
                .filter((x) => x.url)
                .map((x) => (
                  <li key={x.nom}>
                    <a href={x.url as string} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                      {x.nom}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-8 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {r.nomApplication}. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
