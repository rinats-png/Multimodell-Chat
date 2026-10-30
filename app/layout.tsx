import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { headers } from "next/headers";
import { TronBackdrop } from "@/components/shell/TronBackdrop";
import { EFFECTS_INIT_SCRIPT } from "@/lib/effects";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/700.css";
import "./globals.css";

// Alle Seiten dynamisch rendern: Die CSP nutzt eine Nonce pro Anfrage (siehe middleware.ts).
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d9e6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1118" },
  ],
};

export const metadata: Metadata = {
  title: "Multimodell-Chat – KI-Gruppendebatten",
  description: "Diskutiere gleichzeitig mit ChatGPT, Claude und Gemini in einem gemeinsamen Gruppenchat.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // data-theme setzt das Skript vor dem Hydrieren; Browser blenden das nonce-Attribut aus – daher suppressHydrationWarning.
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + EFFECTS_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <TronBackdrop />
        {children}
      </body>
    </html>
  );
}
