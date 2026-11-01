"use client";

import clsx from "clsx";
import { Brain, Coins, Eraser, FileText, Hand, Info, Loader2, Menu, MessagesSquare, PanelRight, Receipt, Repeat2, ScanSearch, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { applySlidingWindow } from "@/lib/context-builder";
import { COUNCIL_GROUPS, COUNCIL_PRESETS } from "@/lib/council-presets";
import { DECISION_TEMPLATES, type DecisionTemplate } from "@/lib/decision-templates";
import { formatCompact, formatUsd } from "@/lib/format";
import type { PlanLimits } from "@/lib/plans";
import type {
  AgentPatch,
  ChatMessage,
  ChatRoom,
  OrchestrateEvent,
  OrchestrationMode,
  PublicProfile,
  RoomAgent,
  RoomSettingsPatch,
} from "@/lib/types";
import { AppHeader } from "@/components/shell/AppHeader";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { Segmented } from "@/components/ui/Segmented";
import { AgentStudio } from "./AgentStudio";
import { Composer } from "./Composer";
import { ControlPanel } from "./ControlPanel";
import { AgentTiles } from "./AgentTiles";
import { MessageItem, RouterNote, StreamingMessage, WindowDivider } from "./MessageItem";
import { PromptInspector, type InspectorTarget } from "./PromptInspector";
import { SideTile } from "./SideTile";

interface ChatWorkspaceProps {
  initialRoom: ChatRoom;
  initialAgents: RoomAgent[];
  initialMessages: ChatMessage[];
  initialProfile: PublicProfile;
  rooms: ChatRoom[];
  email: string | null;
  isDemoStore: boolean;
  isDemoModel: boolean;
  limits: PlanLimits;
  modelCatalog: { id: string; label: string }[];
  /** Mit eigenem Key darf jede Modell-ID eingetragen werden. */
  freeModelChoice: boolean;
}

interface RouterNoteItem {
  id: string;
  /** Anzahl Nachrichten zum Zeitpunkt der Entscheidung → Position im Verlauf */
  position: number;
  agentId: string | null;
  reason: string;
}

interface StreamingTurn {
  tempId: string;
  agentId: string;
  text: string;
}

const MODE_OPTIONS = [
  { value: "router" as const, label: "Moderator", icon: Brain },
  { value: "round-robin" as const, label: "Reihum", icon: Repeat2 },
  { value: "manual" as const, label: "Manuell", icon: Hand },
];

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [presetBusy, setPresetBusy] = useState<string | null>(null);
  const [council, setCouncil] = useState(false);
  const [councilBusy, setCouncilBusy] = useState(false);
  const [councilStep, setCouncilStep] = useState<string | null>(null);
  const failedRef = useRef(false);
  const [draft, setDraft] = useState<{ text: string; id: number } | null>(null);
  const [room, setRoom] = useState(props.initialRoom);
  const [agents, setAgents] = useState(props.initialAgents);
  const [messages, setMessages] = useState(props.initialMessages);
  const [profile, setProfile] = useState(props.initialProfile);
  const [notes, setNotes] = useState<RouterNoteItem[]>([]);
  const [streaming, setStreaming] = useState<StreamingTurn | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"controls" | "agents" | null>(null);
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Anzahl Nachrichten synchron mitzählen: Moderator-Hinweise kommen im selben Stream direkt nach
  // einem turn-end, bevor React neu gerendert hat – der State wäre dann noch veraltet.
  const messageCount = useRef(messages.length);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<RoomSettingsPatch>({});
  // Stand vor der ersten ungespeicherten Änderung: bei einem Fehler wird nur zurückgesetzt, was geändert wurde
  const settingsBefore = useRef<ChatRoom | null>(null);

  // Verlässt man den Raum, wird eine laufende Antwort abgebrochen (spart Kosten, kein Weiterlesen im Hintergrund)
  useEffect(() => () => abortRef.current?.abort(), []);

  const agentById = useCallback((id: string | null) => agents.find((a) => a.id === id), [agents]);

  useEffect(() => {
    const el = scrollRef.current;
    // Leerer Raum: oben bleiben, damit die Überschrift der Startseite sichtbar ist.
    if (el && (messages.length > 0 || streaming)) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, streaming?.text, notes.length]);

  // ---- Orchestrierung ----------------------------------------------------

  function handleEvent(event: OrchestrateEvent) {
    switch (event.type) {
      case "user-message":
        messageCount.current += 1;
        setMessages((prev) => [...prev, event.message]);
        break;
      case "router":
        setNotes((prev) => [
          ...prev,
          { id: crypto.randomUUID(), position: messageCount.current, agentId: event.agentId, reason: event.reason },
        ]);
        break;
      case "turn-start":
        setStreaming({ tempId: event.tempId, agentId: event.agentId, text: "" });
        break;
      case "delta":
        setStreaming((prev) => (prev && prev.tempId === event.tempId ? { ...prev, text: prev.text + event.text } : prev));
        break;
      case "turn-end": {
        setStreaming(null);
        const message = event.message;
        if (message) {
          messageCount.current += 1;
          setMessages((prev) => [...prev, message]);
        }
        break;
      }
      case "stance":
        setMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, stance: event.stance, stance_target_id: event.targetId } : m)));
        break;
      case "summary":
        setRoom((prev) => ({ ...prev, running_summary: event.summary, summarized_message_count: event.summarizedCount }));
        break;
      case "usage":
        setProfile(event.profile);
        break;
      case "error":
        failedRef.current = true;
        setError(event.message);
        break;
      case "done":
        break;
    }
  }

  /** Führt eine Runde aus. Gibt true zurück, wenn sie ohne Fehler und ohne Abbruch endete (die Ratssitzung kettet darauf auf). */
  async function orchestrate(body: { content?: string; agentId?: string; round?: 1 | 2 | 3 }): Promise<boolean> {
    setError(null);
    failedRef.current = false;
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, ...body }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const retry = res.headers.get("Retry-After");
        throw new Error(
          (data.error ?? `Fehler ${res.status}`) + (res.status === 429 && retry && !data.error?.includes(" s ") ? ` (erneut in ${retry} s)` : ""),
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line) as OrchestrateEvent);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        failedRef.current = true;
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    } finally {
      setStreaming(null);
      setRunning(false);
      abortRef.current = null;
    }
    return !failedRef.current && !controller.signal.aborted;
  }

  /** Ratssitzung: Eröffnung, Streit, Abstimmung (je eine Anfrage), danach der Entscheidungsbericht. Fehler oder Stopp beenden die Kette. */
  async function runCouncil(content: string) {
    setCouncilBusy(true);
    try {
      for (const round of [1, 2, 3] as const) {
        setCouncilStep(`Runde ${round} von 3`);
        if (!(await orchestrate({ ...(round === 1 ? { content } : {}), round }))) return;
      }
      setCouncilStep("Bericht wird erstellt …");
      await createReport();
    } finally {
      setCouncilBusy(false);
      setCouncilStep(null);
    }
  }

  // ---- Einstellungen & Agenten --------------------------------------------

  function updateRoom(patch: RoomSettingsPatch) {
    if (!settingsBefore.current) settingsBefore.current = room;
    setRoom((prev) => ({ ...prev, ...patch }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(async () => {
      const merged = pendingPatch.current;
      const before = settingsBefore.current;
      pendingPatch.current = {};
      settingsBefore.current = null;
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Einstellung konnte nicht gespeichert werden");
        if (before) {
          const restored = Object.fromEntries(Object.keys(merged).map((k) => [k, before[k as keyof ChatRoom]]));
          setRoom((prev) => ({ ...prev, ...restored }));
        }
      } else if (merged.title) router.refresh();
    }, 350);
  }

  async function updateAgent(agentId: string, patch: AgentPatch) {
    const res = await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json()) as { agent?: RoomAgent; error?: string };
    if (!res.ok || !data.agent) throw new Error(data.error ?? "Speichern fehlgeschlagen");
    setAgents((prev) => prev.map((a) => (a.id === agentId ? data.agent! : a)));
  }

  async function createAgent() {
    const res = await fetch(`/api/rooms/${room.id}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_identifier: "meta-llama/llama-3.3-70b-instruct",
        display_name: "Llama",
        role_title: "Datengetriebener Analyst",
        system_prompt:
          "Du bist Llama, der datengetriebene Analyst. Du forderst Zahlen, Benchmarks und Belege ein und " +
          "rechnest Behauptungen der anderen KIs nach. Antworte prägnant (max. ca. 150 Wörter).",
      }),
    });
    const data = (await res.json()) as { agent?: RoomAgent; error?: string };
    if (!res.ok || !data.agent) return setError(data.error ?? "Agent konnte nicht angelegt werden");
    setAgents((prev) => [...prev, data.agent!]);
  }

  async function deleteAgent(agentId: string) {
    const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
    if (!res.ok) return setError("Agent konnte nicht entfernt werden");
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  }

  async function clearHistory() {
    if (!confirm("Gesamten Verlauf dieser Debatte löschen? Der Token-Verbrauch bleibt bestehen.")) return;
    const res = await fetch(`/api/rooms/${room.id}/messages`, { method: "DELETE" });
    if (!res.ok) return setError("Verlauf konnte nicht gelöscht werden");
    messageCount.current = 0;
    setMessages([]);
    setNotes([]);
    setRoom((prev) => ({ ...prev, running_summary: "", summarized_message_count: 0 }));
  }

  const agentReplies = messages.filter((m) => m.sender_type === "agent").length;

  /** Vorgefertigten Rat einsetzen (leere Debatte): ersetzt die Agenten und füllt den Starttext ein. */
  async function applyPreset(presetId: string) {
    setPresetBusy(presetId);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/council`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preset: presetId }) });
      const data = (await res.json().catch(() => ({}))) as { room?: ChatRoom; agents?: RoomAgent[]; starter?: string; error?: string };
      if (!res.ok || !data.agents || !data.room) return setError(data.error ?? "Der Rat konnte nicht eingesetzt werden.");
      setAgents(data.agents);
      setRoom(data.room);
      if (data.starter) setDraft({ text: data.starter, id: Date.now() });
      if (data.agents.filter((a) => a.is_active).length >= 2) setCouncil(true);
    } catch {
      setError("Keine Verbindung. Bitte prüfe dein Netz und versuche es erneut.");
    } finally {
      setPresetBusy(null);
    }
  }

  /** Entscheidungsbericht (F-21): fasst die Debatte zu Optionen, Wertungen, Einwand und nächsten Schritten zusammen. */
  async function createReport() {
    setReporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}/report`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { report?: { id: string }; error?: string };
      if (!res.ok || !data.report) return setError(data.error ?? "Der Bericht konnte nicht erstellt werden.");
      router.push(`/report/${data.report.id}`);
    } catch {
      setError("Keine Verbindung. Bitte prüfe dein Netz und versuche es erneut.");
    } finally {
      setReporting(false);
    }
  }

  // ---- Render ---------------------------------------------------------------

  const activeAgents = agents.filter((a) => a.is_active);
  const windowStart = messages.length - applySlidingWindow(messages, room.sliding_window_size).length;
  const streamingAgent = streaming ? agentById(streaming.agentId) : undefined;

  const timeline: React.ReactNode[] = [];
  const notesAt = (pos: number) =>
    notes
      .filter((n) => n.position === pos)
      .forEach((n) => timeline.push(<RouterNote key={n.id} agent={agentById(n.agentId)} reason={n.reason} />));
  messages.forEach((message, index) => {
    notesAt(index);
    if (index === windowStart && windowStart > 0) {
      timeline.push(<WindowDivider key="window" size={room.sliding_window_size} />);
    }
    timeline.push(
      <MessageItem
        key={message.id}
        message={message}
        agent={agentById(message.agent_id)}
        outsideWindow={index < windowStart}
        targetName={agentById(message.stance_target_id)?.display_name}
        onInspect={message.agent_id ? () => setInspector({ agentId: message.agent_id!, uptoIndex: index }) : undefined}
      />,
    );
  });
  notesAt(messages.length);

  const modeLabel = room.orchestration_mode === "router" ? "Moderator" : room.orchestration_mode === "round-robin" ? "Reihum" : "Manuell";
  const statusText = running
    ? streamingAgent
      ? `${streamingAgent.display_name} ${streaming && streaming.text ? "antwortet" : "denkt"}`
      : "Übertragung läuft"
    : "Bereit";

  const title = editingTitle ? (
    <input
      autoFocus
      defaultValue={room.title}
      aria-label="Titel der Debatte"
      onBlur={(e) => {
        setEditingTitle(false);
        const t = e.target.value.trim();
        if (t && t !== room.title) updateRoom({ title: t });
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="field min-w-0 px-2.5 py-1 text-[15px] font-medium"
    />
  ) : (
    <div className="min-w-0">
      <button onClick={() => setEditingTitle(true)} className="block max-w-full truncate rounded-lg px-1 font-display text-[22px] leading-tight hover:bg-surface-3/50" title="Titel bearbeiten">
        {room.title}
      </button>
      <div className={clsx("truncate px-1 text-[12px]", running ? "hud-live" : "text-muted")} aria-live="polite">
        {statusText} · {activeAgents.length} {activeAgents.length === 1 ? "KI" : "KIs"} · {modeLabel}
      </div>
    </div>
  );

  const actions = (
    <>
      <Segmented<OrchestrationMode>
        ariaLabel="Orchestrierungs-Modus"
        size="sm"
        value={room.orchestration_mode}
        options={MODE_OPTIONS}
        onChange={(v) => updateRoom({ orchestration_mode: v })}
      />
      <button
        onClick={createReport}
        disabled={running || councilBusy || reporting || agentReplies < 2}
        title={agentReplies < 2 ? "Der Bericht braucht mindestens zwei Antworten der KIs" : "Aus dieser Debatte einen Entscheidungsbericht erstellen"}
        className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
      >
        {reporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
        {reporting ? "Erstelle …" : "Bericht"}
      </button>
      <IconButton label="API-Prompt Inspector" onClick={() => setInspector({ agentId: activeAgents[0]?.id ?? agents[0]?.id ?? "" })}>
        <ScanSearch className="size-4" />
      </IconButton>
      <IconButton label="Verlauf leeren" onClick={clearHistory} disabled={running || messages.length === 0}>
        <Eraser className="size-4" />
      </IconButton>
      <IconButton label="Steuerung & Agenten-Studio" onClick={() => setPanel(panel ? null : "controls")} active={panel !== null}>
        <PanelRight className="size-4" />
      </IconButton>
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3.5 p-3 sm:p-4 lg:h-dvh lg:overflow-hidden">
      <AppHeader active="chat" email={props.email} isDemoStore={props.isDemoStore} title={title} actions={actions} />

      {props.isDemoModel && (
        <div className="glass tile px-4 py-2 text-center text-[12.5px] text-ink-2">
          Demo-Modus: Antworten werden simuliert.{" "}
          <a href="/billing" className="font-semibold underline underline-offset-2">
            Verbinde OpenRouter oder einen API-Key
          </a>{" "}
          für echte Modelle.
        </div>
      )}

      <AgentTiles
        agents={agents}
        messages={messages}
        streamingAgentId={streaming?.agentId ?? null}
        streamingLength={streaming?.text.length ?? 0}
        canAsk={!running && room.orchestration_mode === "manual"}
        onAsk={(agentId) => orchestrate({ agentId })}
        onToggle={(agent) => updateAgent(agent.id, { is_active: !agent.is_active }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen"))}
      />

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <main className="glass tile relative flex min-h-[70dvh] min-w-0 flex-col overflow-hidden lg:min-h-0">
          <div ref={scrollRef} role="log" aria-live="polite" aria-label="Verlauf der Debatte" className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.length === 0 && !running ? (
                <EmptyState agents={activeAgents} onPick={(t) => setDraft({ text: t.text, id: Date.now() })} onPreset={applyPreset} presetBusy={presetBusy} />
              ) : (
                timeline
              )}
              {streaming && streamingAgent && <StreamingMessage agent={streamingAgent} text={streaming.text} />}
            </div>
          </div>

          {error && (
            <div role="alert" className="mx-auto mb-2 flex w-full max-w-3xl items-start gap-2 px-4">
              <div className="flex w-full items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger backdrop-blur">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} aria-label="Fehler schließen">
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          <Composer
            agents={agents}
            mode={room.orchestration_mode}
            running={running || councilBusy}
            onSend={(content) => (council ? runCouncil(content) : orchestrate({ content }))}
            onAskAgent={(agentId) => orchestrate({ agentId })}
            onStop={() => abortRef.current?.abort()}
            draft={draft}
            council={council}
            onCouncilChange={activeAgents.length >= 2 ? setCouncil : undefined}
            councilStep={councilStep}
          />
        </main>

        <SideTile
          agents={agents}
          messages={messages}
          profile={profile}
          rooms={props.rooms.map((r) => (r.id === room.id ? { ...r, title: room.title } : r))}
          activeRoomId={room.id}
          windowStart={windowStart}
          windowSize={room.sliding_window_size}
        />
      </div>

      {panel && <div className="fixed inset-0 z-30 bg-canvas/60 backdrop-blur-sm" onClick={() => setPanel(null)} aria-hidden />}
      {panel && (
        <aside aria-label="Steuerung und Agenten-Studio" className="glass-strong fixed inset-y-3 right-3 z-40 flex w-[min(380px,calc(100vw-1.5rem))] flex-col rounded-3xl">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line/50 px-3">
            <Segmented
              ariaLabel="Panel"
              size="sm"
              value={panel}
              options={[
                { value: "controls" as const, label: "Steuerung" },
                { value: "agents" as const, label: "Agenten-Studio" },
              ]}
              onChange={setPanel}
            />
            <IconButton label="Panel schließen" onClick={() => setPanel(null)}>
              <X className="size-4" />
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto">
            {panel === "controls" ? (
              <ControlPanel room={room} messages={messages} onChange={updateRoom} limits={props.limits} />
            ) : (
              <AgentStudio
                agents={agents}
                onUpdate={updateAgent}
                onCreate={createAgent}
                onDelete={deleteAgent}
                modelCatalog={props.modelCatalog}
                freeModelChoice={props.freeModelChoice}
                maxActiveAgents={props.limits.maxActiveAgents}
              />
            )}
          </div>
        </aside>
      )}

      <PromptInspector target={inspector} onClose={() => setInspector(null)} room={room} agents={agents} messages={messages} />
    </div>
  );
}

function IconButton(props: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.label}
      aria-label={props.label}
      className={clsx(
        "rounded-xl p-2 text-muted transition-colors hover:bg-surface-3/60 hover:text-ink disabled:opacity-40",
        props.active && "bg-accent/12 text-accent ring-1 ring-accent/25",
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}

function EmptyState({ agents, onPick, onPreset, presetBusy }: { agents: RoomAgent[]; onPick: (template: DecisionTemplate) => void; onPreset: (presetId: string) => void; presetBusy: string | null }) {
  return (
    <div className="flex flex-col items-center pt-[2vh] text-center">
      <div className="relative flex -space-x-2">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-accent/20 blur-2xl" aria-hidden />
        {agents.map((a) => (
          <AgentAvatar key={a.id} name={a.display_name} modelId={a.model_identifier} size="lg" className="ring-4 ring-canvas-2" />
        ))}
      </div>
      <h2 className="mt-4 font-display text-[26px] font-medium leading-tight tracking-tight sm:text-[30px]">
        <span className="text-gradient">Worüber sollen die KIs debattieren?</span>
      </h2>
      <p className="mt-2 max-w-md text-[14px] text-muted">
        {agents.map((a) => a.display_name).join(", ")} diskutieren mit dir – und miteinander. Jede KI vertritt eine
        eigene Fachrolle und widerspricht, statt nur zuzustimmen.
      </p>
      <div className="mt-4 w-full max-w-2xl text-left">
        <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Rat wählen</h3>
        <p className="mt-1 px-1 text-[12.5px] text-muted">Fertige Rollen für typische Aufgaben. Die Rollen sind erfundene Denkschulen, keine echten Personen.</p>
        {COUNCIL_GROUPS.map((group) => (
          <div key={group.title} className="mt-3">
            <h4 className="px-1 text-[12.5px] font-semibold text-ink-2">{group.title}</h4>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {group.presetIds.map((id) => {
                const p = COUNCIL_PRESETS.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => onPreset(p.id)}
                    disabled={presetBusy !== null}
                    title={`Rollen: ${p.agents.map((a) => a.display_name).join(", ")}`}
                    className="flex flex-col rounded-xl border border-line/80 bg-surface/30 px-4 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.06] disabled:opacity-50"
                  >
                    <span className="text-[13.5px] font-medium text-ink">{presetBusy === p.id ? "Setze ein …" : p.title}</span>
                    <span className="text-[12px] text-muted">{p.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 w-full max-w-2xl text-left">
        <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Mit einer Entscheidung starten</h3>
        <p className="mt-1 px-1 text-[12.5px] text-muted">Die Vorlage füllt das Eingabefeld. Trage deine Zahlen ein und sende. Danach erstellst du oben den Bericht.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {DECISION_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="group flex flex-col rounded-xl border border-line/80 bg-surface/30 px-4 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.06]"
            >
              <span className="text-[13.5px] font-medium text-ink">{t.title}</span>
              <span className="text-[12px] text-muted">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-5 flex max-w-2xl items-start gap-2 rounded-xl border border-accent/15 bg-accent/[0.05] px-3 py-2 text-left text-[12.5px] text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>
          Alle Antworten stammen von KI-Modellen. Deine Nachrichten gehen zur Beantwortung über OpenRouter an die jeweiligen
          Modellanbieter (OpenAI, Anthropic, Google u. a.). Bitte keine sensiblen Daten eingeben.{" "}
          <a href="/datenschutz" className="underline">
            Mehr erfahren
          </a>
        </span>
      </p>
    </div>
  );
}
