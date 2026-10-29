"use client";

import clsx from "clsx";
import { CreditCard, LogOut, MessagesSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCompact } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import type { ChatRoom, PublicProfile } from "@/lib/types";
import { Meter } from "@/components/ui/Meter";

interface SidebarProps {
  rooms: ChatRoom[];
  activeRoomId?: string;
  profile: PublicProfile;
  email: string | null;
  isDemoStore: boolean;
  active?: "chat" | "billing";
}

export function Sidebar({ rooms, activeRoomId, profile, email, isDemoStore, active = "chat" }: SidebarProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const plan = PLANS[profile.subscription_tier];

  async function createRoom() {
    setCreating(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const { room } = (await res.json()) as { room: ChatRoom };
      router.push(`/chat/${room.id}`);
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
    const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-openai via-google to-anthropic">
          <MessagesSquare className="size-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold">Multimodell</div>
          <div className="text-[11px] text-muted">KI-Gruppendebatten</div>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={createRoom}
          disabled={creating}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-[13px] font-medium hover:bg-surface-3 disabled:opacity-60"
        >
          <Plus className="size-4" />
          Neue Debatte
        </button>
      </div>

      <nav className="mt-4 px-2">
        <Link
          href="/billing"
          className={clsx(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px]",
            active === "billing" ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2",
          )}
        >
          <CreditCard className="size-4 text-muted" />
          Tarif & Verbrauch
        </Link>
      </nav>

      <div className="mt-5 px-4 text-[11px] font-medium uppercase tracking-wider text-muted">Debatten</div>
      <ul className="mt-1.5 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {rooms.length === 0 && <li className="px-2.5 py-2 text-xs text-muted">Noch keine Debatten.</li>}
        {rooms.map((room) => (
          <li key={room.id} className="group relative">
            <Link
              href={`/chat/${room.id}`}
              className={clsx(
                "block truncate rounded-lg py-1.5 pl-2.5 pr-8 text-[13px]",
                room.id === activeRoomId ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {room.title}
            </Link>
            <button
              onClick={() => deleteRoom(room.id)}
              className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted hover:text-red-400 group-hover:block"
              aria-label={`${room.title} löschen`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="m-3 rounded-xl border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium text-ink">{plan.name}</span>
          <span className="text-muted">
            {profile.has_custom_key
              ? "Eigener Key"
              : `${formatCompact(profile.tokens_used_this_month)} / ${formatCompact(profile.monthly_token_limit)}`}
          </span>
        </div>
        {!profile.has_custom_key && (
          <Meter value={profile.tokens_used_this_month} max={profile.monthly_token_limit} className="mt-2" />
        )}
        <div className="mt-1.5 text-[11px] text-muted">
          Tokens diesen Monat · {profile.rate_limit_per_min} Anfragen/Min
        </div>
        {profile.subscription_tier !== "team" && (
          <Link
            href="/billing"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-strong"
          >
            <Sparkles className="size-3.5" />
            Upgrade
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-2">
          {(email ?? "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12px] text-ink">{email ?? "Unbekannt"}</div>
          <div className="text-[11px] text-muted">{isDemoStore ? "Demo-Workspace" : plan.name}</div>
        </div>
        {!isDemoStore && (
          <button onClick={signOut} className="rounded p-1 text-muted hover:text-ink" aria-label="Abmelden">
            <LogOut className="size-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
