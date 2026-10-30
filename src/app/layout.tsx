import type { Metadata } from "next";
import { AppProviders } from "@/components/providers";
import "./globals.css";
import "./ciel.css";

export const instant = false;

export const metadata: Metadata = {
  title: "Keur Santé",
  description: "Keur Santé — scribe médical IA pour les consultations médicales au Sénégal.",
};

// Applique le thème mémorisé avant le premier rendu (évite le flash clair/sombre).
const themeScript = `try{var t=localStorage.getItem("ks_theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Polices de la maquette */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
