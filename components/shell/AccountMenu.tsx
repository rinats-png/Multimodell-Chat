"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Konto-Menü im Kopf: E-Mail, Tarif, Rechtliches, Abmelden (im Demo-Workspace ohne Abmelden). */
export function AccountMenu({ email, isDemoStore }: { email: string | null; isDemoStore: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }

  const initials = (email ?? "?").slice(0, 2).toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Konto"
        className="flex size-9 items-center justify-center rounded-full border border-line/70 bg-surface/50 text-[12px] font-semibold text-ink hover:bg-surface-2"
      >
        {email ? initials : <User className="size-4" />}
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-3">
          <p className="truncate px-1 text-[13px] font-medium text-ink">{email ?? "Unbekannt"}</p>
          <p className="px-1 text-[12px] text-muted">{isDemoStore ? "Demo-Workspace" : "Angemeldet"}</p>
          <Link role="menuitem" href="/billing" className="mt-3 block rounded-xl px-2 py-2 text-[13px] text-ink-2 hover:bg-surface-3/60 hover:text-ink">
            Tarif & Verbrauch
          </Link>
          {!isDemoStore && (
            <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-3/60 hover:text-ink">
              <LogOut className="size-4" />
              Abmelden
            </button>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/60 px-1 pt-3 sm:hidden">
            <span className="text-[12px] text-muted">Darstellung</span>
            <ThemeToggle />
          </div>
          <LegalLinks className="mt-2 border-t border-line/60 px-1 pt-3" />
        </div>
      )}
    </div>
  );
}
