"use client";

import clsx from "clsx";
import { CreditCard, LogOut, MessagesSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChatRoom } from "@/lib/types";
import { BrandMark } from "@/components/ui/BrandMark";
import { EffectsToggle } from "@/components/ui/EffectsToggle";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface IconRailProps {
  active: "chat" | "billing";
  isDemoStore: boolean;
}

/** Schwebende Icon-Leiste (ab md): Marke, Hauptbereiche, Darstellung, Abmelden. */
export function IconRail({ active, isDemoStore }: IconRailProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { room?: ChatRoom; error?: string };
      if (res.ok && data.room) {
        router.push(`/chat/${data.room.id}`);
        router.refresh();
      } else {
        setCreateError(data.error ?? "Debatte konnte nicht angelegt werden");
      }
    } catch {
      setCreateError("Keine Verbindung. Bitte erneut versuchen.");
    } finally {
      setCreating(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav aria-label="Hauptbereiche" className="glass tron-edge hidden w-[64px] shrink-0 flex-col items-center gap-2 self-center rounded-[10px] py-3 md:flex">
      <Link href="/chat" aria-label="Multimodell – Start" className="mb-2">
        <BrandMark className="size-10 rounded-[6px]" />
      </Link>
      <RailItem label="Debatten" href="/chat" active={active === "chat"}>
        <MessagesSquare className="size-[18px]" />
      </RailItem>
      <RailItem label={createError ? `Neue Debatte – ${createError}` : "Neue Debatte"} onClick={createRoom} disabled={creating}>
        <Plus className="size-[18px]" />
      </RailItem>
      <RailItem label="Tarif & Verbrauch" href="/billing" active={active === "billing"}>
        <CreditCard className="size-[18px]" />
      </RailItem>
      <div className="my-2 h-px w-7 bg-line/70" aria-hidden />
      <ThemeToggle vertical className="border-0 bg-transparent" />
      <div className="my-1 h-px w-7 bg-line/70" aria-hidden />
      <EffectsToggle vertical className="border-0 bg-transparent" />
      {!isDemoStore && (
        <>
          <div className="my-2 h-px w-7 bg-line/70" aria-hidden />
          <RailItem label="Abmelden" onClick={signOut}>
            <LogOut className="size-[18px]" />
          </RailItem>
        </>
      )}
    </nav>
  );
}

function RailItem({
  label,
  href,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls = clsx(
    "flex size-10 items-center justify-center rounded-[6px] transition-all",
    active
      ? "bg-gradient-to-b from-[var(--btn-from)] to-[var(--btn-to)] text-on-accent shadow-[0_0_22px_-4px_var(--btn-glow)]"
      : "text-muted hover:bg-surface-3/60 hover:text-ink",
    disabled && "opacity-50",
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cls}>
      {children}
    </button>
  );
}
