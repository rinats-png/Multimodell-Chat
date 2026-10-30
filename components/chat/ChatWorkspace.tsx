"use client";

import clsx from "clsx";
import { Brain, Eraser, Hand, Info, Menu, PanelRight, Repeat2, ScanSearch, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { applySlidingWindow } from "@/lib/context-builder";
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
import { Sidebar } from "@/components/shell/Sidebar";
import { AgentAvatar } from "@/components/ui/AgentAvatar";
import { Segmented } from "@/components/ui/Segmented";
import { AgentStudio } from "./AgentStudio";
import { Composer } from "./Composer";
import { ControlPanel } from "./ControlPanel";
import { MessageItem, RouterNote, StreamingMessage, WindowDivider } from "./MessageItem";
import { PromptInspector, type InspectorTarget } from "./PromptInspector";

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
  { value: "round-robin" as const, label: "Round-Robin", icon: Repeat2 },
  { value: "manual" as const, label: "Manuell", icon: Hand },
];

const STARTER_PROMPTS = [
  "Wir wollen ein B2B-SaaS für Steuerberater bauen. MVP in 6 Wochen – realistisch?",
  "Monolith oder Microservices für ein Startup mit 3 Entwicklern?",
  "Wie sollten wir die Preise für eine KI-App kalkulieren, deren Kosten pro Nutzer stark schwanken?",
];

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const router = useRouter();
  const [room, setRoom] = useState(props.initialRoom);
  const [agents, setAgents] = useState(props.initialAgents);
  const [messages, setMessages] = useState(props.initialMessages);
  const [profile, setProfile] = useState(props.initialProfile);
  const [notes, setNotes] = useState<RouterNoteItem[]>([]);
  const [streaming, setStreaming] = useState<StreamingTurn | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"controls" | "agents" | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Anzahl Nachrichten synchron mitzählen: Moderator-Hinweise kommen im selben Stream direkt nach
  // einem turn-end, bevor React neu gerendert hat – der State wäre dann noch veraltet.
  const messageCount = useRef(messages.length);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<RoomSettingsPatch>({});

  const agentById = useCallback((id: string | null) => agents.find((a) => a.id === id), [agents]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
      case "summary":
        setRoom((prev) => ({ ...prev, running_summary: event.summary, summarized_message_count: event.summarizedCount }));
        break;
      case "usage":
        setProfile(event.profile);
        break;
      case "error":
        setError(event.message);
        break;
      case "done":
        break;
    }
  }

  async function orchestrate(body: { content?: string; agentId?: string }) {
    setError(null);
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
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      }
    } finally {
      setStreaming(null);
      setRunning(false);
      abortRef.current = null;
    }
  }

  // ---- Einstellungen & Agenten --------------------------------------------

  function updateRoom(patch: RoomSettingsPatch) {
    setRoom((prev) => ({ ...prev, ...patch }));
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(async () => {
      const merged = pendingPatch.current;
      pendingPatch.current = {};
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Einstellung konnte nicht gespeichert werden");
        setRoom(props.initialRoom);
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

  // Auf breiten Bildschirmen startet das Seitenpanel geöffnet, sonst als Schublade bei Bedarf.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) setPanel("controls");
  }, []);

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
        onInspect={message.agent_id ? () => setInspector({ agentId: message.agent_id!, uptoIndex: index }) : undefined}
      />,
    );
  });
  notesAt(messages.length);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        rooms={props.rooms.map((r) => (r.id === room.id ? { ...r, title: room.title } : r))}
        activeRoomId={room.id}
        profile={profile}
        email={props.email}
        isDemoStore={props.isDemoStore}
        mobileOpen={navOpen}
        onMobileClose={() => setNavOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col md:py-3 md:pl-3 xl:pr-0">
        <header className="glass mx-2 mt-2 flex h-14 shrink-0 items-center gap-2 rounded-2xl px-2 sm:gap-3 sm:px-3 md:mx-0 md:mt-0 md:mr-3">
          <IconButton label="Navigation öffnen" onClick={() => setNavOpen(true)} className="md:hidden">
            <Menu className="size-4" />
          </IconButton>
          {editingTitle ? (
            <input
              autoFocus
              defaultValue={room.title}
              onBlur={(e) => {
                setEditingTitle(false);
                const title = e.target.value.trim();
                if (title && title !== room.title) updateRoom({ title });
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="field min-w-0 px-2.5 py-1 text-[14px] font-medium"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="min-w-0 truncate rounded-lg px-2 py-1 text-[14px] font-semibold tracking-tight hover:bg-surface-3/50"
              title="Titel bearbeiten"
            >
              {room.title}
            </button>
          )}

          <div className="hidden -space-x-1.5 md:flex">
            {activeAgents.map((a) => (
              <AgentAvatar key={a.id} name={a.display_name} modelId={a.model_identifier} size="sm" className="ring-2 ring-surface" />
            ))}
          </div>

          <div className="mx-auto hidden lg:block">
            <Segmented<OrchestrationMode>
              ariaLabel="Orchestrierungs-Modus"
              size="sm"
              value={room.orchestration_mode}
              options={MODE_OPTIONS}
              onChange={(v) => updateRoom({ orchestration_mode: v })}
            />
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <IconButton label="API-Prompt Inspector" onClick={() => setInspector({ agentId: activeAgents[0]?.id ?? agents[0]?.id ?? "" })}>
              <ScanSearch className="size-4" />
            </IconButton>
            <IconButton label="Verlauf leeren" onClick={clearHistory} disabled={running || messages.length === 0}>
              <Eraser className="size-4" />
            </IconButton>
            <IconButton label="Steuerung & Agenten-Studio" onClick={() => setPanel(panel ? null : "controls")} active={panel !== null}>
              <PanelRight className="size-4" />
            </IconButton>
          </div>
        </header>

        {props.isDemoModel && (
          <div className="mx-2 mt-2 rounded-xl border border-anthropic/25 bg-anthropic/10 px-4 py-1.5 text-center text-[12px] text-anthropic backdrop-blur md:mx-0 md:mr-3">
            Demo-Modus: Kein OpenRouter-Key konfiguriert – Antworten werden lokal simuliert. Setze{" "}
            <code className="font-mono">OPENROUTER_API_KEY</code> für echte Modelle.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
            {messages.length === 0 && !running ? (
              <EmptyState agents={activeAgents} onPick={(p) => orchestrate({ content: p })} />
            ) : (
              timeline
            )}
            {streaming && streamingAgent && <StreamingMessage agent={streamingAgent} text={streaming.text} />}
          </div>
        </div>

        {error && (
          <div className="mx-auto mb-2 flex w-full max-w-3xl items-start gap-2 px-4">
            <div className="flex w-full items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-200 backdrop-blur">
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
          running={running}
          onSend={(content) => orchestrate({ content })}
          onAskAgent={(agentId) => orchestrate({ agentId })}
          onStop={() => abortRef.current?.abort()}
        />
      </main>

      {panel && <div className="fixed inset-0 z-30 bg-canvas/70 backdrop-blur-sm xl:hidden" onClick={() => setPanel(null)} aria-hidden />}
      {panel && (
        <aside
          aria-label="Steuerung und Agenten-Studio"
          className="glass-strong fixed inset-y-2 right-2 z-40 flex w-[min(344px,calc(100vw-1rem))] shrink-0 flex-col rounded-2xl xl:static xl:z-auto xl:my-3 xl:mr-3 xl:h-[calc(100dvh-1.5rem)] xl:glass"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line/70 px-3">
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
            <IconButton label="Panel schließen" onClick={() => setPanel(null)} className="xl:hidden">
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

      <PromptInspector
        target={inspector}
        onClose={() => setInspector(null)}
        room={room}
        agents={agents}
        messages={messages}
      />
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

function EmptyState({ agents, onPick }: { agents: RoomAgent[]; onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-[6vh] text-center">
      <div className="relative flex -space-x-2">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-accent/20 blur-2xl" aria-hidden />
        {agents.map((a) => (
          <AgentAvatar key={a.id} name={a.display_name} modelId={a.model_identifier} size="lg" className="ring-4 ring-canvas-2" />
        ))}
      </div>
      <h1 className="mt-6 font-display text-[26px] font-medium leading-tight tracking-tight sm:text-[30px]">
        <span className="text-gradient">Worüber sollen die KIs debattieren?</span>
      </h1>
      <p className="mt-2 max-w-md text-[14px] text-muted">
        {agents.map((a) => a.display_name).join(", ")} diskutieren mit dir – und miteinander. Jede KI vertritt eine
        eigene Fachrolle und widerspricht, statt nur zuzustimmen.
      </p>
      <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
        {agents.map((a) => (
          <div key={a.id} className="glass rounded-2xl p-3.5 text-left">
            <div className="flex items-center gap-2">
              <AgentAvatar name={a.display_name} modelId={a.model_identifier} size="sm" />
              <span className="text-[13px] font-medium">{a.display_name}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{a.role_title}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 flex max-w-2xl items-start gap-2 rounded-xl border border-accent/15 bg-accent/[0.05] px-3 py-2 text-left text-[12.5px] text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>
          Alle Antworten stammen von KI-Modellen. Deine Nachrichten gehen zur Beantwortung über OpenRouter an die jeweiligen
          Modellanbieter (OpenAI, Anthropic, Google u. a.). Bitte keine sensiblen Daten eingeben.{" "}
          <a href="/datenschutz" className="underline">
            Mehr erfahren
          </a>
        </span>
      </p>
      <div className="mt-4 flex w-full max-w-2xl flex-col gap-1.5">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-surface/30 px-4 py-2.5 text-left text-[13px] text-ink-2 transition-colors hover:border-accent/40 hover:bg-accent/[0.06] hover:text-ink"
          >
            <span>{p}</span>
            <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
