"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Brain, ScanSearch } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { agentStyle } from "@/lib/agent-style";
import { formatNumber, formatTime, formatUsd } from "@/lib/format";
import type { ChatMessage, RoomAgent } from "@/lib/types";
import { AgentAvatar } from "@/components/ui/AgentAvatar";

interface MessageItemProps {
  message: ChatMessage;
  agent: RoomAgent | undefined;
  outsideWindow: boolean;
  onInspect?: () => void;
}

/** Externe Bilder aus Modellantworten werden nicht geladen (Datenabfluss per Prompt-Injection, BF-31). */
const MARKDOWN_COMPONENTS = {
  img: ({ alt }: { alt?: string }) => <span className="text-muted">[Bild: {alt || "ohne Beschreibung"}]</span>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-chat text-[14.5px] text-ink-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function MessageItem({ message, agent, outsideWindow, onInspect }: MessageItemProps) {
  if (message.sender_type === "user") {
    return (
      <div className={clsx("flex justify-end", outsideWindow && "opacity-55")}>
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-br-md border border-accent/25 bg-gradient-to-br from-accent/[0.16] to-accent/[0.05] px-4 py-2.5 text-[14.5px] leading-relaxed text-ink shadow-[0_8px_24px_-14px_rgb(79_216_255/0.6)] backdrop-blur">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="mt-1 text-right text-[11px] text-muted">{formatTime(message.created_at)}</div>
        </div>
      </div>
    );
  }

  const modelId = agent?.model_identifier ?? "other/unknown";
  const style = agentStyle(modelId);
  return (
    <article
      className={clsx("group glass flex gap-3 rounded-2xl p-4", outsideWindow && "opacity-50")}
      data-ai-generated="true"
      aria-label={`KI-Antwort von ${message.sender_name}`}
    >
      <AgentAvatar name={message.sender_name} modelId={modelId} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={clsx("text-[13.5px] font-semibold", style.text)}>{message.sender_name}</span>
          {agent && <span className="text-[12px] text-muted">{agent.role_title}</span>}
          <span className="text-[11px] text-muted">· {formatTime(message.created_at)}</span>
          <span className="rounded-md border border-accent/25 bg-accent/10 px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-accent-strong" title="Von KI erzeugt">
            KI
          </span>
        </div>
        <div className="mt-1">
          <Markdown>{message.content}</Markdown>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted">
          <span className="inline-flex items-center gap-0.5 rounded-md border border-line/80 bg-canvas/40 px-1.5 py-0.5" title="Input-Tokens">
            <ArrowUpRight className="size-3" />
            {formatNumber(message.input_tokens)}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-md border border-line/80 bg-canvas/40 px-1.5 py-0.5" title="Output-Tokens">
            <ArrowDownRight className="size-3" />
            {formatNumber(message.output_tokens)}
          </span>
          <span className="rounded-md border border-line/80 bg-canvas/40 px-1.5 py-0.5" title="Geschätzte Kosten">
            {formatUsd(message.estimated_cost_usd)}
          </span>
          {agent && <span className="hidden px-1 sm:inline">{agent.model_identifier}</span>}
          {onInspect && (
            <button
              onClick={onInspect}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-sans text-[11.5px] transition-opacity hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <ScanSearch className="size-3.5" />
              API-Prompt
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function StreamingMessage({ agent, text }: { agent: RoomAgent; text: string }) {
  const style = agentStyle(agent.model_identifier);
  return (
    <div className="glass flex gap-3 rounded-2xl p-4 ring-1 ring-accent/20">
      <AgentAvatar name={agent.display_name} modelId={agent.model_identifier} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={clsx("text-[13.5px] font-semibold", style.text)}>{agent.display_name}</span>
          <span className="text-[12px] text-muted">{agent.role_title}</span>
        </div>
        <div className="mt-1">
          {text ? (
            <div className="streaming-caret">
              <Markdown>{text}</Markdown>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 py-2 text-[13px] text-muted">
              <span className={clsx("live-dot size-2 rounded-full", style.dot)} />
              {agent.display_name} denkt nach…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RouterNote({ agent, reason }: { agent: RoomAgent | undefined; reason: string }) {
  return (
    <div className="flex items-center gap-3 py-0.5 text-[12px] text-muted">
      <div className="h-px flex-1 bg-line" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-canvas-2/70 px-3 py-1 backdrop-blur">
        <Brain className="size-3.5 text-accent" aria-hidden />
        Moderator{agent ? <> → <span className={agentStyle(agent.model_identifier).text}>{agent.display_name}</span></> : null}
        <span className="text-muted/80">· {reason}</span>
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

export function WindowDivider({ size }: { size: number }) {
  return (
    <div className="flex items-center gap-3 text-center text-[10.5px] uppercase tracking-[0.14em] text-accent-strong/80">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-accent/50" />
      Sliding Window · nur die letzten {size} Nachrichten gehen an die Modelle
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-accent/50" />
    </div>
  );
}
