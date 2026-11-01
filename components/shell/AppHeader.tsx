"use client";

import clsx from "clsx";
import { CreditCard, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AccountMenu } from "./AccountMenu";

interface AppHeaderProps {
  active: "chat" | "billing";
  email: string | null;
  isDemoStore: boolean;
  /** Mitte: Titel der Seite oder Debatte */
  title?: React.ReactNode;
  /** Rechts vor Darstellung und Konto: Modus, Werkzeuge */
  actions?: React.ReactNode;
}

function NavLink({ href, active, icon: Icon, children }: { href: string; active: boolean; icon: typeof CreditCard; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors",
        active ? "bg-accent text-on-accent" : "text-ink-2 hover:bg-surface-3/60 hover:text-ink",
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="hidden sm:inline">{children}</span>
      <span className="sr-only sm:hidden">{children}</span>
    </Link>
  );
}

/** Kopf-Kachel aller Seiten im Bühne-Raster: Marke, Bereiche, Titel, Werkzeuge, Darstellung, Konto. */
export function AppHeader({ active, email, isDemoStore, title, actions }: AppHeaderProps) {
  return (
    <header className="glass tile relative z-20 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Link href="/chat" className="flex items-center gap-2.5" aria-label="SynthrAI – Debatten">
        <BrandMark className="size-8" />
        <span className="hidden sm:block">
          <Wordmark tagline className="text-[26px]" />
        </span>
      </Link>
      <nav aria-label="Hauptbereiche" className="flex items-center gap-1">
        <NavLink href="/chat" active={active === "chat"} icon={MessagesSquare}>
          Debatten
        </NavLink>
        <NavLink href="/billing" active={active === "billing"} icon={CreditCard}>
          Tarif & Verbrauch
        </NavLink>
      </nav>
      {title && <div className="min-w-0 flex-1 basis-48">{title}</div>}
      <div className={clsx("flex flex-wrap items-center gap-2", title ? "ml-auto" : "ml-auto")}>
        {actions}
        <ThemeToggle className="max-sm:hidden" />
        <AccountMenu email={email} isDemoStore={isDemoStore} />
      </div>
    </header>
  );
}
