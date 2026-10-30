"use client";

import clsx from "clsx";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AgentPatch, RoomAgent } from "@/lib/types";
import { AgentAvatar } from "@/components/ui/AgentAvatar";

interface AgentStudioProps {
  agents: RoomAgent[];
  onUpdate: (agentId: string, patch: AgentPatch) => Promise<void>;
  onCreate: () => Promise<void>;
  onDelete: (agentId: string) => Promise<void>;
  modelCatalog: { id: string; label: string }[];
  freeModelChoice: boolean;
  maxActiveAgents: number;
}

export function AgentStudio({ agents, onUpdate, onCreate, onDelete, modelCatalog, freeModelChoice, maxActiveAgents }: AgentStudioProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  return (
    <div className="space-y-2 p-4">
      <p className="pb-1 text-[12px] leading-relaxed text-muted">
        Rollen und System-Prompts gelten ab dem nächsten Turn. Die Gruppenchat-Regeln (kein Namens-Präfix, keine
        Schmeichelei) werden automatisch angehängt. In deinem Tarif antworten bis zu {maxActiveAgents} aktive Agenten.
      </p>
      {toggleError && (
        <p role="alert" className="text-[12px] text-danger">
          {toggleError}
        </p>
      )}
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          open={openId === agent.id}
          onToggle={() => setOpenId(openId === agent.id ? null : agent.id)}
          onUpdate={(patch) => onUpdate(agent.id, patch)}
          onToggleActive={async () => {
            setToggleError(null);
            try {
              await onUpdate(agent.id, { is_active: !agent.is_active });
            } catch (e) {
              setToggleError(e instanceof Error ? e.message : "Änderung fehlgeschlagen");
            }
          }}
          onDelete={() => onDelete(agent.id)}
          modelCatalog={modelCatalog}
          freeModelChoice={freeModelChoice}
        />
      ))}
      <button
        onClick={onCreate}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/30 py-2.5 text-[13px] text-ink-2 transition-colors hover:bg-accent/[0.06] hover:text-ink"
      >
        <Plus className="size-4" />
        Agent hinzufügen
      </button>
    </div>
  );
}

interface AgentCardProps {
  agent: RoomAgent;
  open: boolean;
  onToggle: () => void;
  onUpdate: (patch: AgentPatch) => Promise<void>;
  onToggleActive: () => Promise<void>;
  onDelete: () => Promise<void>;
  modelCatalog: { id: string; label: string }[];
  freeModelChoice: boolean;
}

function AgentCard({ agent, open, onToggle, onUpdate, onToggleActive, onDelete, modelCatalog, freeModelChoice }: AgentCardProps) {
  const [draft, setDraft] = useState({
    display_name: agent.display_name,
    role_title: agent.role_title,
    model_identifier: agent.model_identifier,
    system_prompt: agent.system_prompt,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty =
    draft.display_name !== agent.display_name ||
    draft.role_title !== agent.role_title ||
    draft.model_identifier !== agent.model_identifier ||
    draft.system_prompt !== agent.system_prompt;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onUpdate(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "field mt-1 px-2.5 py-1.5 text-[13px]";

  return (
    <div className={clsx("rounded-xl border bg-canvas/35", open ? "border-accent/30 shadow-[0_0_24px_-12px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]" : "border-line/80")}>
      <div className="flex items-center gap-2.5 p-2.5">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <AgentAvatar name={agent.display_name} modelId={agent.model_identifier} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{agent.display_name}</span>
            <span className="block truncate text-[11.5px] text-muted">{agent.role_title}</span>
          </span>
          <ChevronDown className={clsx("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </button>
        <button
          role="switch"
          aria-checked={agent.is_active}
          aria-label={`${agent.display_name} ${agent.is_active ? "deaktivieren" : "aktivieren"}`}
          onClick={onToggleActive}
          className={clsx(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            agent.is_active ? "bg-gradient-to-r from-accent-deep to-accent shadow-[0_0_12px_-2px_color-mix(in_srgb,var(--color-accent)_80%,transparent)]" : "bg-surface-3 ring-1 ring-line-strong",
          )}
        >
          <span
            className={clsx(
              "absolute top-0.5 size-4 rounded-full bg-white transition-all",
              agent.is_active ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line/70 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11.5px] text-muted">
              Name
              <input className={inputCls} value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} />
            </label>
            <label className="text-[11.5px] text-muted">
              Modell
              {freeModelChoice ? (
                <input
                  className={inputCls}
                  list={`model-catalog-${agent.id}`}
                  value={draft.model_identifier}
                  onChange={(e) => setDraft({ ...draft, model_identifier: e.target.value })}
                />
              ) : (
                <select
                  className={inputCls}
                  value={draft.model_identifier}
                  onChange={(e) => setDraft({ ...draft, model_identifier: e.target.value })}
                >
                  {!modelCatalog.some((m) => m.id === draft.model_identifier) && (
                    <option value={draft.model_identifier}>{draft.model_identifier} (nur mit eigenem Key)</option>
                  )}
                  {modelCatalog.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
          <label className="block text-[11.5px] text-muted">
            Rolle
            <input className={inputCls} value={draft.role_title} onChange={(e) => setDraft({ ...draft, role_title: e.target.value })} />
          </label>
          <label className="block text-[11.5px] text-muted">
            System-Prompt
            <textarea
              rows={7}
              className={clsx(inputCls, "resize-y font-mono text-[12px] leading-relaxed")}
              value={draft.system_prompt}
              onChange={(e) => setDraft({ ...draft, system_prompt: e.target.value })}
            />
          </label>
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <div className="flex items-center justify-between">
            <button
              onClick={() => confirm(`${agent.display_name} aus dem Raum entfernen?`) && onDelete()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-muted hover:text-danger"
            >
              <Trash2 className="size-3.5" />
              Entfernen
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="btn-primary px-3 py-1.5 text-[12px]"
            >
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      )}
      <datalist id={`model-catalog-${agent.id}`}>
        {modelCatalog.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
