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
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <Image src="/brand/nzilabiz-icone-transparent.png" alt="" width={28} height={28} />
              <span className="font-extrabold">{r.nomApplication}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              La gestion de boutique pensée pour les commerçants d&apos;Afrique centrale. Caisse, stock,
              créances et rapports — même sans réseau.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Produit</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
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
            <p className="mb-2 text-sm font-bold">Légal</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
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
            <p className="mb-2 text-sm font-bold">Contact</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
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

        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {r.nomApplication}. Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}
