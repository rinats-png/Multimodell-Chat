"use client";

import clsx from "clsx";
import { agentStyle } from "@/lib/agent-style";
import { formatCompact } from "@/lib/format";
import { providerOf } from "@/lib/models";
import type { ChatMessage, RoomAgent } from "@/lib/types";
import { ThinkField, type FieldState } from "./ThinkField";

interface HudRailProps {
  agents: RoomAgent[];
  messages: ChatMessage[];
  /** Index der ersten Nachricht, die noch im Kontextfenster der KIs liegt. */
  windowStart: number;
  windowSize: number;
  /** KI, die gerade einen Beitrag schreibt (turn-start bis turn-end). */
  streamingAgentId: string | null;
  streamingLength: number;
  running: boolean;
  canAsk: boolean;
  onAsk: (agentId: string) => void;
}

const WINDOW_CELLS = 20;
const SHARE_CELLS = 72;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-3.5">
      <h2 className="hud mb-2.5 flex items-center gap-2 text-accent">
        <span className="size-1.5 bg-accent shadow-[0_0_8px_var(--color-accent)]" aria-hidden />
        {title}
        <span className="h-px flex-1 bg-line" aria-hidden />
      </h2>
      {children}
    </section>
  );
}

/** Informationsleiste links vom Chat: Denkfeld, Stimmen, Verlauf. Nur echte Werte aus dem Raum. */
export function HudRail({ agents, messages, windowStart, windowSize, streamingAgentId, streamingLength, running, canAsk, onAsk }: HudRailProps) {
  const active = agents.filter((a) => a.is_active);
  const speaker = agents.find((a) => a.id === streamingAgentId);
  const state: FieldState = !running ? "idle" : speaker && streamingLength > 0 ? "talk" : "think";
  const provider = speaker ? providerOf(speaker.model_identifier) : null;

  const tokensOf = (id: string) => messages.filter((m) => m.agent_id === id).reduce((s, m) => s + m.input_tokens + m.output_tokens, 0);

  // Verlauf: die letzten 20 Beiträge, außerhalb des Kontextfensters gedimmt
  const recent = messages.slice(-WINDOW_CELLS);
  const offset = messages.length - recent.length;
  const dotOf = (m: ChatMessage) => (m.sender_type === "agent" && m.agent_id ? agentStyle(agents.find((a) => a.id === m.agent_id)?.model_identifier ?? "").dot : "bg-line-strong");

  // Redeanteil: jede Nachricht belegt Felder im Verhältnis zu ihrer Länge
  const units: string[] = [];
  for (const m of messages) {
    const n = Math.max(1, Math.round(m.content.length / 90));
    for (let i = 0; i < n; i++) units.push(dotOf(m));
  }
  const shareCells = units.slice(-SHARE_CELLS);

  return (
    <aside aria-label="Denkfeld und Stimmen" className="hidden w-[232px] shrink-0 flex-col gap-3 overflow-y-auto p-3 min-[1280px]:flex">
      <Panel title="Denkfeld">
        <div className="relative h-[132px] overflow-hidden border border-line bg-canvas/40 shadow-[inset_0_0_22px_-6px_var(--tron-glow)]">
          <ThinkField state={state} provider={provider} pulse={streamingLength} className="absolute inset-0 size-full" />
        </div>
        <dl className="mt-2.5 space-y-1 font-mono text-[10.5px]">
          <Row label="Modell" value={speaker ? speaker.model_identifier.split("/").pop() ?? "-" : "-"} />
          <Row label="Zustand" value={state === "think" ? "denkt" : state === "talk" ? "antwortet" : "ruhend"} />
          <Row label="Fenster" value={`${Math.min(messages.length - windowStart, windowSize)} / ${windowSize}`} />
        </dl>
      </Panel>

      <Panel title="Stimmen">
        <ul className="-mx-1">
          {active.map((a) => {
            const style = agentStyle(a.model_identifier);
            const live = a.id === streamingAgentId;
            const status = live ? (streamingLength > 0 ? "spricht" : "denkt") : "bereit";
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!canAsk}
                  onClick={() => onAsk(a.id)}
                  title={canAsk ? `${a.display_name} direkt antworten lassen` : undefined}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 px-1 py-2 text-left enabled:hover:bg-accent/[0.06] disabled:cursor-default"
                >
                  <span className={clsx("size-3 rounded-full shadow-[0_0_12px_2px_currentColor]", style.dot, style.text, live && "live-dot")} aria-hidden />
                  <span className={clsx("truncate font-display text-[13px] font-bold tracking-wide", live ? style.text : "text-ink")}>{a.display_name}</span>
                  <span className="font-mono text-[10.5px] text-muted">{formatCompact(tokensOf(a.id))}</span>
                  <span />
                  <span className="col-span-2 truncate font-mono text-[10.5px] text-muted">
                    {a.model_identifier.split("/").pop()} · {status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Verlauf">
        <div className="mb-3 grid grid-cols-[repeat(20,1fr)] gap-[2px]" role="img" aria-label="Die letzten 20 Beiträge; gedimmt liegen außerhalb des Kontextfensters">
          {Array.from({ length: WINDOW_CELLS }, (_, i) => {
            const m = recent[i - (WINDOW_CELLS - recent.length)];
            return <i key={i} className={clsx("h-3.5 -skew-x-[24deg] border border-line/60", m ? dotOf(m) : "bg-line/30", m && i - (WINDOW_CELLS - recent.length) + offset < windowStart && "opacity-35")} />;
          })}
        </div>
        <div className="grid grid-cols-[repeat(12,1fr)] gap-[3px]" role="img" aria-label="Redeanteil der letzten Beiträge">
          {Array.from({ length: SHARE_CELLS }, (_, i) => {
            const dot = shareCells[i - (SHARE_CELLS - shareCells.length)];
            return <i key={i} className={clsx("aspect-square", dot ?? "bg-line/30", dot && "opacity-85")} />;
          })}
        </div>
      </Panel>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
