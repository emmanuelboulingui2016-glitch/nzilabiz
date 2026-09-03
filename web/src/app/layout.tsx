import type { Metadata, Viewport } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
// Serif Didone pour les titres d'affichage de la vitrine (voir globals.css → --font-serif).
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "./globals.css";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import { ThemeProvider } from "@/lib/theme-provider";
import { ServiceWorkerRegistration } from "@/components/pwa/sw-registration";

export const metadata: Metadata = {
  title: "NzilaBiz — Gérez votre boutique, simplement, au quotidien",
  description:
    "NzilaBiz est une application de gestion de boutique (caisse, stock, créances, dépenses) pensée pour les commerçants d'Afrique centrale, 100% utilisable hors connexion.",
  manifest: "/manifest.json",
  // Toutes les tailles sont déclarées, de 16 à 512 : c'est le navigateur qui choisit la plus
  // adaptée à l'endroit où il l'affiche — onglet, favori, raccourci de bureau, barre des tâches.
  // Sans les petites tailles, il réduit la grande et le dessin devient flou.
  //
  // Attention : un fichier `favicon.ico` placé dans `src/app/` prendrait le pas sur celui de
  // `public/`, par convention de Next.js. Le gabarit de départ en installe un — celui de Vercel —
  // qui masquait silencieusement le nôtre.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F9D58",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" dir="ltr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <ThemeProvider>
            {children}
            <Toaster position="top-center" richColors />
          </ThemeProvider>
        </I18nProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
