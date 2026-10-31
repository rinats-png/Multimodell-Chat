"use client";

import clsx from "clsx";
import { agentStyle } from "@/lib/agent-style";
import { formatCompact } from "@/lib/format";
import { providerOf } from "@/lib/models";
import type { ChatMessage, RoomAgent } from "@/lib/types";

interface AgentTilesProps {
  agents: RoomAgent[];
  messages: ChatMessage[];
  /** KI, die gerade einen Beitrag schreibt (turn-start bis turn-end). */
  streamingAgentId: string | null;
  streamingLength: number;
  /** Modus „Manuell“ und keine Antwort läuft: ein Klick lässt die KI antworten. */
  canAsk: boolean;
  onAsk: (agentId: string) => void;
  onToggle: (agent: RoomAgent) => void;
}

/** Eine große Kachel je KI: Zustand, Verbrauch, letzte Aussage, Schalter. Die Kachel leuchtet, solange die KI dran ist. */
export function AgentTiles({ agents, messages, streamingAgentId, streamingLength, canAsk, onAsk, onToggle }: AgentTilesProps) {
  const sorted = [...agents].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <section
      aria-label="Stimmen der Debatte"
      className="grid snap-x snap-mandatory auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:snap-none"
    >
      {sorted.map((agent) => {
        const style = agentStyle(agent.model_identifier);
        const live = agent.id === streamingAgentId;
        const status = !agent.is_active ? "aus" : live ? (streamingLength > 0 ? "spricht" : "denkt") : "bereit";
        const own = messages.filter((m) => m.agent_id === agent.id);
        const last = own.at(-1);
        const tokens = own.reduce((s, m) => s + m.input_tokens + m.output_tokens, 0);
        const c = `var(--color-${providerOf(agent.model_identifier)})`;
        return (
          <article
            key={agent.id}
            style={{ "--c": c, background: `linear-gradient(160deg, color-mix(in srgb, ${c} 22%, transparent), transparent 70%), linear-gradient(150deg, var(--glass-1), var(--glass-2))` } as React.CSSProperties}
            className={clsx(
              "glass tile relative flex min-h-[132px] snap-start flex-col gap-1.5 p-4 transition-opacity [@media(max-height:800px)]:min-h-[108px] [@media(max-height:800px)]:p-3",
              live && "agent-live",
              !agent.is_active && "opacity-60",
            )}
          >
            <button
              type="button"
              role="switch"
              aria-checked={agent.is_active}
              aria-label={`${agent.display_name} aktiv`}
              onClick={() => onToggle(agent)}
              className={clsx("absolute right-3.5 top-3.5 h-[22px] w-[38px] rounded-full border border-line/70 transition-colors", agent.is_active ? "bg-[var(--c)]" : "bg-surface-3")}
            >
              <span className={clsx("absolute top-[2px] size-4 rounded-full transition-all", agent.is_active ? "left-[18px] bg-white" : "left-[2px] bg-muted")} />
            </button>
            <h2 className={clsx("pr-12 font-display text-[24px] leading-none", style.text)}>{agent.display_name}</h2>
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <span className={clsx("size-2 rounded-full", style.dot, live && "live-dot")} aria-hidden />
              <span>
                {status} · {formatCompact(tokens)} tok
              </span>
            </p>
            <p className="line-clamp-3 text-[13.5px] leading-snug text-ink [@media(max-height:800px)]:line-clamp-2">
              {last ? last.content.replace(/[*_`#>]/g, "") : agent.role_title}
            </p>
            {canAsk && agent.is_active && (
              <button type="button" onClick={() => onAsk(agent.id)} className="btn-ghost mt-auto self-start px-3 py-1 text-[12px]">
                Antworten lassen
              </button>
            )}
          </article>
        );
      })}
    </section>
  );
}
