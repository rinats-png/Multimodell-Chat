"use client";

import clsx from "clsx";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { agentStyle } from "@/lib/agent-style";
import { formatCompact } from "@/lib/format";
import { providerOf } from "@/lib/models";
import type { ChatMessage, RoomAgent, Stance } from "@/lib/types";
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

function Panel({ title, children, collapsible = false, defaultOpen = true }: { title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const heading = (
    <>
      <span className="size-1.5 bg-accent shadow-[0_0_8px_var(--color-accent)]" aria-hidden />
      {title}
      <span className="h-px flex-1 bg-line" aria-hidden />
      {collapsible && <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />}
    </>
  );
  return (
    <section className="glass rounded-2xl p-3.5">
      <h2 className="hud text-accent">
        {collapsible ? (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 text-left uppercase">
            {heading}
          </button>
        ) : (
          <span className="flex items-center gap-2">{heading}</span>
        )}
      </h2>
      {open && <div className="mt-2.5">{children}</div>}
    </section>
  );
}

const COLLAPSE_KEY = "mm-hud-collapsed";

/** Informationsleiste links vom Chat: Denkfeld, Stimmen, Verlauf. Nur echte Werte aus dem Raum. */
export function HudRail({ agents, messages, windowStart, windowSize, streamingAgentId, streamingLength, running, canAsk, onAsk }: HudRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Speicher gesperrt: Leiste bleibt offen.
    }
  }, []);
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        // nur für diese Sitzung
      }
      return !c;
    });
  }

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

  if (collapsed) {
    return (
      <aside aria-label="Denkfeld und Stimmen (eingeklappt)" className="hidden w-12 shrink-0 flex-col items-center gap-3 py-3 min-[1280px]:flex">
        <button type="button" onClick={toggle} aria-label="Leiste ausklappen" title="Leiste ausklappen" className="rounded-lg p-2 text-muted hover:bg-surface-3/60 hover:text-ink">
          <PanelLeftOpen className="size-4" />
        </button>
        {active.map((a) => (
          <span
            key={a.id}
            title={`${a.display_name}${a.id === streamingAgentId ? " · aktiv" : ""}`}
            className={clsx("size-3 rounded-full shadow-[0_0_10px_2px_currentColor]", agentStyle(a.model_identifier).dot, agentStyle(a.model_identifier).text, a.id === streamingAgentId && "live-dot")}
          />
        ))}
      </aside>
    );
  }

  return (
    <aside aria-label="Denkfeld und Stimmen" className="hidden w-[232px] shrink-0 flex-col gap-3 overflow-y-auto p-3 min-[1280px]:flex">
      <button type="button" onClick={toggle} aria-label="Leiste einklappen" title="Leiste einklappen" className="-mb-1 ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-3/60 hover:text-ink">
        <PanelLeftClose className="size-4" />
      </button>
      <Panel title="Denkfeld">
        <div className="relative h-[132px] overflow-hidden border border-line bg-canvas/40 shadow-[inset_0_0_22px_-6px_var(--tron-glow)]">
          <ThinkField state={state} provider={provider} pulse={streamingLength} className="absolute inset-0 size-full" />
        </div>
        <dl className="mt-2.5 space-y-1 font-mono text-[11px]">
          <Row label="Modell" value={speaker ? speaker.model_identifier.split("/").pop() ?? "-" : "-"} />
          <Row label="Zustand" value={state === "think" ? "denkt" : state === "talk" ? "antwortet" : "ruhend"} />
          <Row label="Fenster" value={`${Math.min(messages.length - windowStart, windowSize)} / ${windowSize}`} />
        </dl>
      </Panel>

      <Panel title="Konsens">
        <ConsensusList agents={agents} messages={messages} />
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
                  <span className="font-mono text-[11px] text-muted">{formatCompact(tokensOf(a.id))}</span>
                  <span />
                  <span className="col-span-2 truncate font-mono text-[11px] text-muted">
                    {a.model_identifier.split("/").pop()} · {status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Verlauf" collapsible defaultOpen={false}>
        <p className="mb-2.5 text-[11px] leading-snug text-muted">Oben: die letzten 20 Beiträge, gedimmt = nicht mehr im Kontext der KIs. Darunter: Redeanteil, je länger der Beitrag, desto mehr Felder.</p>
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

const PAIR_STATE = {
  agree: { label: "Einig", className: "border-signal/45 text-signal" },
  disagree: { label: "Streit", className: "border-danger/50 text-danger" },
  extend: { label: "Weiter", className: "border-accent/45 text-accent" },
  neutral: { label: "Offen", className: "border-line-strong text-muted" },
} as const;

/** Je Paar von KIs der jüngste bewertete Bezug: einig, Streit, weiterführend oder offen. */
function ConsensusList({ agents, messages }: { agents: RoomAgent[]; messages: ChatMessage[] }) {
  const latest = new Map<string, { a: string; b: string; stance: Stance }>();
  for (const m of messages) {
    if (!m.stance || !m.agent_id || !m.stance_target_id) continue;
    const [a, b] = [m.agent_id, m.stance_target_id].sort() as [string, string];
    latest.set(`${a}|${b}`, { a, b, stance: m.stance });
  }
  const nameOf = (id: string) => agents.find((x) => x.id === id)?.display_name ?? "?";
  const rows = [...latest.values()];
  if (rows.length === 0) {
    return <p className="text-[12px] leading-snug text-muted">Erscheint, sobald eine KI auf die Antwort einer anderen reagiert.</p>;
  }
  const fights = rows.filter((r) => r.stance === "disagree").length;
  return (
    <div>
      <p className="mb-2 font-mono text-[11px] text-muted" aria-live="polite">
        {fights > 0 ? `${fights} Streitpunkt${fights > 1 ? "e" : ""} offen` : "Kein offener Streit"}
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const st = PAIR_STATE[r.stance];
          return (
            <li key={`${r.a}|${r.b}`} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="truncate text-ink-2">
                {nameOf(r.a)} <span className="text-muted">⇄</span> {nameOf(r.b)}
              </span>
              <span className={clsx("shrink-0 border px-1.5 font-mono text-[11px] uppercase tracking-[0.08em]", st.className)}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
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
