"use client";

import clsx from "clsx";
import { ArrowUp, ShieldAlert, Square } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { agentStyle } from "@/lib/agent-style";
import { approxTokens } from "@/lib/models";
import { checkPromptInjection } from "@/lib/prompt-firewall";
import type { OrchestrationMode, RoomAgent } from "@/lib/types";
import { AgentAvatar } from "@/components/ui/AgentAvatar";

interface ComposerProps {
  agents: RoomAgent[];
  mode: OrchestrationMode;
  running: boolean;
  onSend: (content: string) => void;
  onAskAgent: (agentId: string) => void;
  onStop: () => void;
}

const MODE_HINT: Record<OrchestrationMode, string> = {
  router: "KI-Moderator wählt die nächsten Sprecher",
  "round-robin": "Alle aktiven KIs antworten reihum",
  manual: "Nur per @Mention oder Schnell-Button",
};

export function Composer({ agents, mode, running, onSend, onAskAgent, onStop }: ComposerProps) {
  const [value, setValue] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const activeAgents = agents.filter((a) => a.is_active);

  const firewall = useMemo(() => checkPromptInjection(value), [value]);
  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    return activeAgents.filter((a) => a.display_name.toLowerCase().startsWith(mentionQuery.toLowerCase()));
  }, [mentionQuery, activeAgents]);

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }

  function updateMention(text: string, caret: number) {
    const match = /(?:^|\s)@([\p{L}\p{N}._-]*)$/u.exec(text.slice(0, caret));
    setMentionQuery(match ? match[1]! : null);
    setMentionIndex(0);
  }

  function insertMention(agent: RoomAgent) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\p{L}\p{N}._-]*)$/u, `@${agent.display_name.split(/\s+/)[0]} `);
    const next = before + value.slice(caret);
    pendingCaret.current = before.length;
    setValue(next);
    setMentionQuery(null);
  }

  // Cursor nach dem Einfügen einer @Mention synchron hinter den Namen setzen.
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  function submit() {
    const content = value.trim();
    if (!content || running || firewall.flagged) return;
    onSend(content);
    setValue("");
    setMentionQuery(null);
    requestAnimationFrame(resize);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOptions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setMentionIndex((i) => (i + delta + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionOptions[mentionIndex]!);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4">
      {activeAgents.length > 0 && (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
          {activeAgents.map((agent) => (
            <button
              key={agent.id}
              disabled={running}
              onClick={() => onAskAgent(agent.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            >
              <span className={clsx("size-1.5 rounded-full", agentStyle(agent.model_identifier).dot)} />
              Lass {agent.display_name} antworten
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        {mentionOptions.length > 0 && (
          <ul className="absolute bottom-full left-3 mb-2 w-64 overflow-hidden rounded-xl border border-line-strong bg-surface-2 p-1 shadow-2xl">
            {mentionOptions.map((agent, i) => (
              <li key={agent.id}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(agent);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
                    i === mentionIndex ? "bg-surface-3" : "hover:bg-surface-3",
                  )}
                >
                  <AgentAvatar name={agent.display_name} modelId={agent.model_identifier} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-ink">{agent.display_name}</span>
                    <span className="block truncate text-[11px] text-muted">{agent.role_title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          className={clsx(
            "rounded-2xl border bg-surface-2 shadow-[0_8px_30px_rgb(0_0_0/0.35)] transition-colors focus-within:border-line-strong",
            firewall.flagged ? "border-red-500/60" : "border-line",
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            placeholder="Stelle eine Frage an die Runde – oder erwähne eine KI mit @Claude …"
            onChange={(e) => {
              setValue(e.target.value);
              updateMention(e.target.value, e.target.selectionStart);
              resize();
            }}
            onKeyDown={onKeyDown}
            className="block max-h-[220px] w-full resize-none bg-transparent px-4 pt-3.5 text-[14.5px] text-ink outline-none placeholder:text-muted"
          />
          <div className="flex items-center gap-3 px-3 pb-2.5 pt-1.5">
            {firewall.flagged ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-red-400">
                <ShieldAlert className="size-3.5" />
                Prompt-Firewall: {firewall.matches.join(", ")}
              </span>
            ) : (
              <span className="truncate text-[12px] text-muted">{MODE_HINT[mode]}</span>
            )}
            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">
              {value ? `≈ ${approxTokens(value)} Tokens` : ""}
            </span>
            {running ? (
              <button
                onClick={onStop}
                className="flex size-8 items-center justify-center rounded-lg bg-ink text-canvas hover:bg-ink-2"
                aria-label="Stoppen"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!value.trim() || firewall.flagged}
                className="flex size-8 items-center justify-center rounded-lg bg-ink text-canvas hover:bg-ink-2 disabled:bg-surface-3 disabled:text-muted"
                aria-label="Senden"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        KIs können Fehler machen und widersprechen sich absichtlich. Enter zum Senden, Shift+Enter für neue Zeile.
      </p>
    </div>
  );
}
