import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource-variable/unbounded";
import "./globals.css";

// Alle Seiten dynamisch rendern: Die CSP nutzt eine Nonce pro Anfrage (siehe middleware.ts).
export const dynamic = "force-dynamic";

export const viewport = { themeColor: "#071521" };

export const metadata: Metadata = {
  title: "Multimodell-Chat – KI-Gruppendebatten",
  description: "Diskutiere gleichzeitig mit ChatGPT, Claude und Gemini in einem gemeinsamen Gruppenchat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
