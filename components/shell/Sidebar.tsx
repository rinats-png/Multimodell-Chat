"use client";

import clsx from "clsx";
import { CreditCard, LogOut, MessagesSquare, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCompact } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import type { ChatRoom, PublicProfile } from "@/lib/types";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";
import { Meter } from "@/components/ui/Meter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface SidebarProps {
  rooms: ChatRoom[];
  activeRoomId?: string;
  profile: PublicProfile;
  email: string | null;
  isDemoStore: boolean;
  active?: "chat" | "billing";
  /** Mobile: Seitenleiste als Schublade geöffnet */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ rooms, activeRoomId, profile, email, isDemoStore, active = "chat", mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = PLANS[profile.subscription_tier];

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { room?: ChatRoom; error?: string };
      if (!res.ok || !data.room) return setError(data.error ?? "Debatte konnte nicht angelegt werden");
      onMobileClose?.();
      router.push(`/chat/${data.room.id}`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function deleteRoom(roomId: string) {
    if (!confirm("Diese Debatte inklusive Verlauf löschen?")) return;
    await fetch(`/api/rooms/${roomId}`, { method: "DELETE" });
    if (roomId === activeRoomId) router.push("/chat");
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
    {mobileOpen && <div className="fixed inset-0 z-30 bg-canvas/70 backdrop-blur-sm md:hidden" onClick={onMobileClose} aria-hidden />}
    <aside
      aria-label="Navigation"
      className={clsx(
        "drawer z-40 flex w-[264px] shrink-0 flex-col max-md:glass-strong",
        "fixed inset-y-2 left-2 rounded-2xl transition-transform",
        "md:relative md:inset-auto md:z-auto md:translate-x-0 md:rounded-none md:border-r md:border-line/50",
        mobileOpen ? "translate-x-0" : "-translate-x-[110%]",
      )}
    >
      <div className="flex items-center gap-3 px-4 pb-4 pt-4">
        <BrandMark className="size-9 md:hidden" />
        <div className="leading-tight">
          <Wordmark className="text-[15px] font-semibold" />
          <div className="mt-0.5 text-[11px] text-muted">KI-Gruppendebatten</div>
        </div>
        {onMobileClose && (
          <button onClick={onMobileClose} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-3/60 hover:text-ink md:hidden" aria-label="Navigation schließen">
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="px-3">
        <button onClick={createRoom} disabled={creating} className="btn-primary w-full px-3 py-2.5 text-[13px]">
          <Plus className="size-4" />
          Neue Debatte
        </button>
        {error && (
          <p role="alert" className="mt-2 text-[12px] text-danger">
            {error}
          </p>
        )}
      </div>

      <nav className="mt-4 px-2">
        <Link
          href="/billing"
          className={clsx(
            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors",
            active === "billing" ? "bg-accent/12 text-ink ring-1 ring-accent/25" : "text-ink-2 hover:bg-surface-3/50 hover:text-ink",
          )}
        >
          <CreditCard className={clsx("size-4", active === "billing" ? "text-accent" : "text-muted")} />
          Tarif & Verbrauch
        </Link>
      </nav>

      <div className="mt-5 flex items-center gap-2 px-5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">
        <MessagesSquare className="size-3.5" />
        Debatten
      </div>
      <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {rooms.length === 0 && <li className="px-3 py-2 text-xs text-muted">Noch keine Debatten.</li>}
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          return (
            <li key={room.id} className="group relative">
              <Link
                href={`/chat/${room.id}`}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-2 truncate rounded-xl py-2 pl-3 pr-8 text-[13px] transition-colors",
                  isActive ? "bg-accent/12 text-ink ring-1 ring-accent/25" : "text-ink-2 hover:bg-surface-3/50 hover:text-ink",
                )}
              >
                <span className={clsx("size-1.5 shrink-0 rounded-full", isActive ? "bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_90%,transparent)]" : "bg-line-strong")} />
                <span className="truncate">{room.title}</span>
              </Link>
              <button
                onClick={() => deleteRoom(room.id)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted opacity-100 hover:text-danger focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label={`${room.title} löschen`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="glow-card relative mx-3 mb-3 overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-b from-accent/[0.08] to-transparent p-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <span className="size-1.5 rounded-full bg-signal" />
            {plan.name}
          </span>
          <span className="font-mono text-[11px] text-ink-2">
            {profile.has_custom_key
              ? "Eigener Zugang"
              : `${formatCompact(profile.tokens_used_this_month)} / ${formatCompact(profile.monthly_token_limit)}`}
          </span>
        </div>
        {!profile.has_custom_key && (
          <Meter value={profile.tokens_used_this_month} max={profile.monthly_token_limit} className="mt-2.5" />
        )}
        <div className="mt-2 text-[11px] text-muted">
          Tokens diesen Monat · {profile.rate_limit_per_min} KI-Antworten/Min
        </div>
        {!profile.has_custom_key && (
          <Link href="/billing" className="btn-ghost mt-3 w-full px-3 py-1.5 text-[12px] font-semibold">
            <Sparkles className="size-3.5 text-accent" />
            Eigenen Zugang verbinden
          </Link>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 px-5 pb-2">
        <LegalLinks />
        <ThemeToggle className="md:hidden" />
      </div>
      <div className="flex items-center gap-2.5 border-t border-line/70 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface-2 text-[11px] font-semibold text-accent-strong ring-1 ring-accent/20">
          {(email ?? "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] text-ink">{email ?? "Unbekannt"}</div>
          <div className="text-[11px] text-muted">{isDemoStore ? "Demo-Workspace" : plan.name}</div>
        </div>
        {!isDemoStore && (
          <button onClick={signOut} className="rounded-lg p-1.5 text-muted hover:bg-surface-3/60 hover:text-ink md:hidden" aria-label="Abmelden">
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </aside>
    </>
  );
}
