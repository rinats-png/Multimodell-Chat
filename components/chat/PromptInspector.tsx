"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { buildAgentMessages } from "@/lib/context-builder";
import { approxTokens, estimateCostUsd } from "@/lib/models";
import { formatNumber, formatUsd } from "@/lib/format";
import type { ChatMessage, ChatRoom, RoomAgent } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { AgentAvatar } from "@/components/ui/AgentAvatar";

export interface InspectorTarget {
  agentId: string;
  /** Verlauf bis (exklusive) zu diesem Index – undefined = nächster Turn. */
  uptoIndex?: number;
}

interface PromptInspectorProps {
  target: InspectorTarget | null;
  onClose: () => void;
  room: ChatRoom;
  agents: RoomAgent[];
  messages: ChatMessage[];
}

const ROLE_STYLE = {
  system: "border-accent/40 bg-accent/10 text-accent-strong",
  user: "border-line-strong bg-surface-3 text-ink-2",
  assistant: "border-openai/40 bg-openai/10 text-openai",
};

/** Zeigt exakt den Payload, den das Backend für einen Agenten an die API schickt. */
export function PromptInspector({ target, onClose, room, agents, messages }: PromptInspectorProps) {
  const [agentId, setAgentId] = useState<string | null>(null);
  const selectedId = agentId ?? target?.agentId ?? agents[0]?.id;
  const agent = agents.find((a) => a.id === selectedId);

  const payload = useMemo(() => {
    if (!agent) return null;
    const history = target?.uptoIndex !== undefined ? messages.slice(0, target.uptoIndex) : messages;
    return buildAgentMessages(agent, history, room.sliding_window_size, {
      agents,
      runningSummary: room.running_summary,
    });
  }, [agent, target, messages, room, agents]);

  const inputTokens = payload ? approxTokens(payload.system + payload.messages.map((m) => m.content).join("")) : 0;

  return (
    <Modal
      open={target !== null}
      onClose={() => {
        setAgentId(null);
        onClose();
      }}
      wide
      title="API-Prompt Inspector"
      subtitle={
        target?.uptoIndex !== undefined
          ? "Payload, der für diese Antwort an das Modell ging (Perspektive des Agenten)"
          : "Payload, der beim nächsten Turn an das Modell gehen würde"
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-5 py-3">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgentId(a.id)}
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-[12.5px]",
              a.id === selectedId ? "border-accent/40 bg-accent/12 text-ink" : "border-line/80 text-muted hover:text-ink-2",
            )}
          >
            <AgentAvatar name={a.display_name} modelId={a.model_identifier} size="sm" />
            {a.display_name}
          </button>
        ))}
        {agent && (
          <span className="ml-auto font-mono text-[11.5px] text-muted">
            {agent.model_identifier} · ≈ {formatNumber(inputTokens)} Input-Tokens · ≈{" "}
            {formatUsd(estimateCostUsd(agent.model_identifier, inputTokens, 0))}
          </span>
        )}
      </div>

      {payload && (
        <div className="space-y-2.5 p-5">
          {[{ role: "system" as const, content: payload.system }, ...payload.messages].map((m, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line/80 bg-canvas/40">
              <div className="flex items-center justify-between border-b border-line/70 bg-surface/50 px-3 py-1.5">
                <span className={clsx("rounded-md border px-1.5 py-0.5 font-mono text-[11px]", ROLE_STYLE[m.role])}>
                  role: &quot;{m.role}&quot;
                </span>
                <span className="font-mono text-[11px] text-muted">≈ {formatNumber(approxTokens(m.content))} Tokens</span>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-2">
                {m.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
