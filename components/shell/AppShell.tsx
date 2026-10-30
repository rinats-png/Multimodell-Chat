"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import type { ChatRoom, PublicProfile } from "@/lib/types";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  rooms: ChatRoom[];
  profile: PublicProfile;
  email: string | null;
  isDemoStore: boolean;
  active: "chat" | "billing";
  title: string;
  children: React.ReactNode;
}

/** Seiten außerhalb des Chats: Seitenleiste + mobile Kopfzeile mit Menü. */
export function AppShell({ rooms, profile, email, isDemoStore, active, title, children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        rooms={rooms}
        profile={profile}
        email={email}
        isDemoStore={isDemoStore}
        active={active}
        mobileOpen={navOpen}
        onMobileClose={() => setNavOpen(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="glass mx-2 mt-2 flex h-14 shrink-0 items-center gap-2 rounded-2xl px-2 md:hidden">
          <button onClick={() => setNavOpen(true)} className="rounded-xl p-2 text-muted hover:bg-surface-3/60 hover:text-ink" aria-label="Navigation öffnen">
            <Menu className="size-4" />
          </button>
          <span className="text-[14px] font-medium">{title}</span>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
