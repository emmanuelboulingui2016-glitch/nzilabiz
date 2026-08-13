import type { Metadata, Viewport } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
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
