"use client";

import clsx from "clsx";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { agentStyle } from "@/lib/agent-style";
import { formatCompact } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import type { ChatMessage, ChatRoom, PublicProfile, RoomAgent, Stance } from "@/lib/types";
import { Meter } from "@/components/ui/Meter";
import { RoomList } from "./RoomList";

const PAIR_STATE = {
  agree: { label: "Einig", className: "border-signal/50 text-signal" },
  disagree: { label: "Streit", className: "border-danger/55 text-danger" },
  extend: { label: "Weiter", className: "border-line-strong text-ink-2" },
  neutral: { label: "Offen", className: "border-line-strong text-muted" },
} as const;

/** Je Paar von KIs der jüngste bewertete Bezug: einig, Streit, weiterführend oder offen. */
export function ConsensusList({ agents, messages }: { agents: RoomAgent[]; messages: ChatMessage[] }) {
  const latest = new Map<string, { a: string; b: string; stance: Stance }>();
  for (const m of messages) {
    if (!m.stance || !m.agent_id || !m.stance_target_id) continue;
    const [a, b] = [m.agent_id, m.stance_target_id].sort() as [string, string];
    latest.set(`${a}|${b}`, { a, b, stance: m.stance });
  }
  const nameOf = (id: string) => agents.find((x) => x.id === id)?.display_name ?? "?";
  const rows = [...latest.values()];
  if (rows.length === 0) {
    return <p className="text-[13px] leading-snug text-muted">Erscheint, sobald eine KI auf die Antwort einer anderen reagiert.</p>;
  }
  const fights = rows.filter((r) => r.stance === "disagree").length;
  return (
    <div>
      <p className="mb-2 text-[12px] text-muted" aria-live="polite">
        {fights > 0 ? `${fights} Streitpunkt${fights > 1 ? "e" : ""} offen` : "Kein offener Streit"}
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const st = PAIR_STATE[r.stance];
          return (
            <li key={`${r.a}|${r.b}`} className="flex items-center justify-between gap-2 border-t border-line/50 pt-1.5 text-[13.5px] first:border-0 first:pt-0">
              <span className="truncate text-ink-2">
                {nameOf(r.a)} <span className="text-muted">⇄</span> {nameOf(r.b)}
              </span>
              <span className={clsx("shrink-0 rounded-full border px-2 text-[11.5px] font-semibold", st.className)}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface SideTileProps {
  agents: RoomAgent[];
  messages: ChatMessage[];
  profile: PublicProfile;
  rooms: ChatRoom[];
  activeRoomId: string;
  /** Index der ersten Nachricht, die noch im Kontextfenster der KIs liegt. */
  windowStart: number;
  windowSize: number;
}

const SHARE_CELLS = 36;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="hud mb-2.5 text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Seitenkachel: Konsens, Verbrauch (mit Redeanteil und Kontextfenster) und Debatten. Nur echte Werte. */
export function SideTile({ agents, messages, profile, rooms, activeRoomId, windowStart, windowSize }: SideTileProps) {
  const plan = PLANS[profile.subscription_tier];
  const pct = profile.monthly_token_limit > 0 ? Math.min(100, Math.round((profile.tokens_used_this_month / profile.monthly_token_limit) * 100)) : 0;

  const dotOf = (m: ChatMessage) => (m.sender_type === "agent" && m.agent_id ? agentStyle(agents.find((a) => a.id === m.agent_id)?.model_identifier ?? "").dot : "bg-muted");
  const units: string[] = [];
  for (const m of messages) {
    const n = Math.max(1, Math.round(m.content.length / 90));
    for (let i = 0; i < n; i++) units.push(dotOf(m));
  }
  const cells = units.slice(-SHARE_CELLS);
  const inContext = Math.min(messages.length - windowStart, windowSize);

  return (
    <aside aria-label="Konsens, Verbrauch und Debatten" className="glass tile flex min-h-0 flex-col gap-6 overflow-y-auto p-4">
      <Section title="Konsens">
        <ConsensusList agents={agents} messages={messages} />
      </Section>

      <Section title="Verbrauch">
        {profile.has_custom_key ? (
          <p className="font-display text-[24px] leading-none">Eigener Zugang</p>
        ) : (
          <>
            <p className="font-display text-[34px] leading-none">{pct} %</p>
            <p className="mb-3 mt-1.5 text-[12.5px] text-muted">
              {formatCompact(profile.tokens_used_this_month)} von {formatCompact(profile.monthly_token_limit)} Tokens · {plan.name}
            </p>
            <Meter value={profile.tokens_used_this_month} max={profile.monthly_token_limit} />
          </>
        )}
        <div className="mt-4 grid grid-cols-[repeat(18,1fr)] gap-[3px]" role="img" aria-label="Redeanteil der letzten Beiträge">
          {Array.from({ length: SHARE_CELLS }, (_, i) => {
            const dot = cells[i - (SHARE_CELLS - cells.length)];
            return <i key={i} className={clsx("aspect-square rounded-[3px]", dot ?? "bg-surface-3/60")} />;
          })}
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Redeanteil dieser Debatte · Kontext {Math.max(0, inContext)} von {windowSize} Nachrichten
        </p>
        {!profile.has_custom_key && (
          <Link href="/billing" className="btn-ghost mt-3 w-full px-3 py-1.5 text-[12.5px] font-semibold">
            <Sparkles className="size-3.5" aria-hidden />
            Eigenen Zugang verbinden
          </Link>
        )}
      </Section>

      <Section title="Debatten">
        <RoomList rooms={rooms} activeRoomId={activeRoomId} />
      </Section>
    </aside>
  );
}
