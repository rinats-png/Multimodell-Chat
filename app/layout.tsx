import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-serif-display/400.css";
import "./globals.css";

// Alle Seiten dynamisch rendern: Die CSP nutzt eine Nonce pro Anfrage (siehe middleware.ts).
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1e8dc" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1816" },
  ],
};

export const metadata: Metadata = {
  title: "SynthrAI – AI Discussion Room",
  description: "Diskutiere gleichzeitig mit ChatGPT, Claude und Gemini in einem gemeinsamen Gruppenchat.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // data-theme setzt das Skript vor dem Hydrieren; Browser blenden das nonce-Attribut aus – daher suppressHydrationWarning.
    <html lang="de" suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
