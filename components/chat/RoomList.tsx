"use client";

import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChatRoom } from "@/lib/types";

/** Liste der Debatten mit „Neue Debatte“ und Löschen. */
export function RoomList({ rooms, activeRoomId }: { rooms: ChatRoom[]; activeRoomId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { room?: ChatRoom; error?: string };
      if (!res.ok || !data.room) return setError(data.error ?? "Debatte konnte nicht angelegt werden");
      router.push(`/chat/${data.room.id}`);
      router.refresh();
    } catch {
      setError("Keine Verbindung. Bitte erneut versuchen.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteRoom(roomId: string) {
    if (!confirm("Diese Debatte inklusive Verlauf löschen?")) return;
    const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Die Debatte konnte nicht gelöscht werden. Bitte versuche es erneut.");
      return;
    }
    if (roomId === activeRoomId) router.push("/chat");
    router.refresh();
  }

  return (
    <div>
      <button onClick={createRoom} disabled={creating} className="btn-primary w-full px-3 py-2 text-[13px]">
        <Plus className="size-4" aria-hidden />
        Neue Debatte
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {error}
        </p>
      )}
      <ul className="mt-2 space-y-0.5">
        {rooms.length === 0 && <li className="px-2 py-2 text-[12px] text-muted">Noch keine Debatten.</li>}
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          return (
            <li key={room.id} className="group relative">
              <Link
                href={`/chat/${room.id}`}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "block truncate rounded-xl py-2 pl-3 pr-9 text-[13.5px] transition-colors",
                  isActive ? "bg-surface-3/70 font-semibold text-ink" : "text-ink-2 hover:bg-surface-3/50 hover:text-ink",
                )}
              >
                {room.title}
              </Link>
              <button
                onClick={() => deleteRoom(room.id)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-danger focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label={`${room.title} löschen`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
