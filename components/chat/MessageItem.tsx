"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, ScanSearch } from "lucide-react";
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

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-chat text-[14.5px] text-ink-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function MessageItem({ message, agent, outsideWindow, onInspect }: MessageItemProps) {
  if (message.sender_type === "user") {
    return (
      <div className={clsx("flex justify-end", outsideWindow && "opacity-55")}>
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[14.5px] leading-relaxed text-ink ring-1 ring-line-strong">
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
    <div className={clsx("group flex gap-3", outsideWindow && "opacity-55")}>
      <AgentAvatar name={message.sender_name} modelId={modelId} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={clsx("text-[13.5px] font-semibold", style.text)}>{message.sender_name}</span>
          {agent && <span className="text-[12px] text-muted">{agent.role_title}</span>}
          <span className="text-[11px] text-muted">· {formatTime(message.created_at)}</span>
        </div>
        <div className="mt-1">
          <Markdown>{message.content}</Markdown>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted">
          <span className="inline-flex items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5" title="Input-Tokens">
            <ArrowUpRight className="size-3" />
            {formatNumber(message.input_tokens)}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-md border border-line px-1.5 py-0.5" title="Output-Tokens">
            <ArrowDownRight className="size-3" />
            {formatNumber(message.output_tokens)}
          </span>
          <span className="rounded-md border border-line px-1.5 py-0.5" title="Geschätzte Kosten">
            {formatUsd(message.estimated_cost_usd)}
          </span>
          {agent && <span className="hidden px-1 sm:inline">{agent.model_identifier}</span>}
          {onInspect && (
            <button
              onClick={onInspect}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-sans text-[11.5px] opacity-0 transition-opacity hover:bg-surface-3 hover:text-ink group-hover:opacity-100"
            >
              <ScanSearch className="size-3.5" />
              API-Prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StreamingMessage({ agent, text }: { agent: RoomAgent; text: string }) {
  const style = agentStyle(agent.model_identifier);
  return (
    <div className="flex gap-3">
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
              <span className={clsx("size-1.5 animate-pulse rounded-full", style.dot)} />
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
        <span aria-hidden>🧠</span>
        Moderator{agent ? <> → <span className={agentStyle(agent.model_identifier).text}>{agent.display_name}</span></> : null}
        <span className="text-muted/80">· {reason}</span>
      </span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

export function WindowDivider({ size }: { size: number }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-accent-strong/80">
      <div className="h-px flex-1 border-t border-dashed border-accent/40" />
      Sliding Window · nur die letzten {size} Nachrichten gehen an die Modelle
      <div className="h-px flex-1 border-t border-dashed border-accent/40" />
    </div>
  );
}
