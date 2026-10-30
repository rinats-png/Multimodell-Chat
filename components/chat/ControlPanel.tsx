"use client";

import { Brain, Hand, Repeat2 } from "lucide-react";
import { formatNumber, formatUsd } from "@/lib/format";
import type { PlanLimits } from "@/lib/plans";
import type { ChatMessage, ChatRoom, OrchestrationMode, RoomSettingsPatch } from "@/lib/types";
import { RangeField } from "@/components/ui/RangeField";

interface ControlPanelProps {
  room: ChatRoom;
  messages: ChatMessage[];
  onChange: (patch: RoomSettingsPatch) => void;
  limits: PlanLimits;
}

const MODES: { value: OrchestrationMode; title: string; description: string; icon: typeof Brain }[] = [
  {
    value: "router",
    title: "KI-Moderator",
    description: "Ein schnelles Router-Modell analysiert die letzten 4 Nachrichten und wählt den nächsten Sprecher per JSON.",
    icon: Brain,
  },
  {
    value: "round-robin",
    title: "Round-Robin",
    description: "Alle aktiven KIs antworten nacheinander, bis Max-Auto-Turns erreicht ist.",
    icon: Repeat2,
  },
  {
    value: "manual",
    title: "Manuell & @Mentions",
    description: "Nur die per @Name oder Schnell-Button angesprochene KI antwortet.",
    icon: Hand,
  },
];

export function ControlPanel({ room, messages, onChange, limits }: ControlPanelProps) {
  const totals = messages.reduce(
    (acc, m) => ({
      input: acc.input + m.input_tokens,
      output: acc.output + m.output_tokens,
      cost: acc.cost + m.estimated_cost_usd,
    }),
    { input: 0, output: 0, cost: 0 },
  );

  return (
    <div className="space-y-6 p-4">
      <section>
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">Orchestrierung</h3>
        <div className="mt-2 space-y-1.5">
          {MODES.map(({ value, title, description, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onChange({ orchestration_mode: value })}
              className={`flex w-full gap-3 rounded-xl border p-3 text-left transition-colors ${
                room.orchestration_mode === value
                  ? "border-accent/50 bg-gradient-to-br from-accent/15 to-accent/[0.03] shadow-[0_0_24px_-10px_color-mix(in_srgb,var(--color-accent)_80%,transparent)]"
                  : "border-line/80 bg-canvas/30 hover:border-accent/30"
              }`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${room.orchestration_mode === value ? "text-accent-strong" : "text-muted"}`} />
              <span>
                <span className="block text-[13px] font-medium text-ink">{title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-2">{description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">Kosten-Bremse</h3>
        <RangeField
          label="Sliding Window"
          hint="Nur die letzten N Nachrichten werden an jedes Modell geschickt. Ältere landen im Langzeitgedächtnis."
          value={Math.min(room.sliding_window_size, limits.maxSlidingWindow)}
          min={2}
          max={limits.maxSlidingWindow}
          suffix="Nachr."
          onChange={(v) => onChange({ sliding_window_size: v })}
        />
        <RangeField
          label="Max-Auto-Turns"
          hint="Harte Obergrenze für automatische KI-Antworten pro User-Nachricht – verhindert Endlosschleifen."
          value={Math.min(room.max_auto_turns, limits.maxAutoTurns)}
          min={1}
          max={limits.maxAutoTurns}
          suffix="Turns"
          onChange={(v) => onChange({ max_auto_turns: v })}
        />
      </section>

      <section>
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">Token-Ledger dieser Debatte</h3>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {[
            ["Input", formatNumber(totals.input)],
            ["Output", formatNumber(totals.output)],
            ["Kosten", formatUsd(totals.cost)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line/80 bg-canvas/40 px-3 py-2.5">
              <dt className="text-[11px] text-muted">{label}</dt>
              <dd className="mt-0.5 font-mono text-[13px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">Langzeitgedächtnis</h3>
        <div className="mt-2 rounded-xl border border-openai/20 bg-gradient-to-br from-openai/[0.07] to-transparent p-3 text-[12.5px] leading-relaxed text-ink-2">
          {!limits.runningSummary ? (
            <p className="text-muted">Das Langzeitgedächtnis ist ab dem Pro-Tarif verfügbar.</p>
          ) : room.running_summary ? (
            <>
              <p>{room.running_summary}</p>
              <p className="mt-2 text-[11px] text-muted">
                Enthält die ersten {room.summarized_message_count} Nachrichten · wird an jeden System-Prompt angehängt
              </p>
            </>
          ) : (
            <p className="text-muted">
              Noch leer. Sobald Nachrichten aus dem Sliding Window fallen, fasst ein Mini-Modell sie in 3 Sätzen zusammen.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
