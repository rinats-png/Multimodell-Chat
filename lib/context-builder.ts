import type { ChatMessage, RoomAgent } from "./types";

export interface AgentPromptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentPrompt {
  system: string;
  messages: AgentPromptMessage[];
}

export interface BuildAgentMessagesOptions {
  /** Alle Agenten im Raum – für die Teilnehmerliste im System-Prompt. */
  agents?: RoomAgent[];
  /** Komprimiertes Langzeitgedächtnis älterer Nachrichten. */
  runningSummary?: string;
}

export const GROUP_CHAT_RULES = [
  "Du bist Teilnehmer eines Gruppenchats mit einem menschlichen User und mehreren anderen KI-Modellen.",
  "Nachrichten anderer Teilnehmer erhältst du im Format `[Sprecher]: Inhalt`.",
  "Antworte NIEMALS mit deinem eigenen Namen in eckigen Klammern am Anfang.",
  "Stimme anderen KIs nicht bloß höflich zu, sondern liefere konstruktive Gegenargumente aus deiner Fachrolle heraus.",
  "Sprich andere Teilnehmer direkt mit Namen an, wenn du auf ihre Argumente eingehst.",
  "Antworte in der Sprache, in der der Mensch schreibt.",
].join("\n- ");

/** Schneidet den Verlauf hart auf die letzten `windowSize` Nachrichten zu. */
export function applySlidingWindow<T>(items: T[], windowSize: number): T[] {
  const size = Math.max(1, Math.floor(windowSize));
  return items.length > size ? items.slice(items.length - size) : items;
}

/** Label, mit dem eine fremde Nachricht für den Ziel-Agenten markiert wird. */
export function speakerLabel(message: ChatMessage): string {
  switch (message.sender_type) {
    case "user":
      return `Mensch – ${message.sender_name}`;
    case "agent":
      return `KI – ${message.sender_name}`;
    case "system":
      return "Moderator";
  }
}

/** Entfernt ein vom Modell fälschlich vorangestelltes `[Name]:`-Präfix. */
export function stripSpeakerPrefix(text: string): string {
  return text.replace(/^\s*\[[^\]\n]{1,60}\]:\s*/, "");
}

function buildSystemPrompt(target: RoomAgent, options: BuildAgentMessagesOptions): string {
  const parts = [target.system_prompt.trim(), "", "## Regeln für den Gruppenchat", `- ${GROUP_CHAT_RULES}`];

  const others = (options.agents ?? []).filter((a) => a.id !== target.id && a.is_active);
  if (others.length > 0) {
    parts.push(
      "",
      "## Teilnehmer",
      `- Du: ${target.display_name} (${target.role_title})`,
      ...others.map((a) => `- ${a.display_name}: ${a.role_title}`),
      "- Der menschliche User, der die Debatte leitet",
    );
  }

  const summary = options.runningSummary?.trim();
  if (summary) {
    parts.push("", "## Zusammenfassung des bisherigen Verlaufs (ältere Nachrichten)", summary);
  }
  return parts.join("\n");
}

/**
 * Baut den API-Payload für genau einen Agenten (Perspektiven-Umkehr):
 * - eigene frühere Antworten → `assistant`
 * - Mensch + alle anderen KIs → `user` mit vorangestelltem `[Sprecher]:`
 * Aufeinanderfolgende Nachrichten derselben Rolle werden zusammengeführt,
 * damit auch strikte Provider (Anthropic) die Rollenfolge akzeptieren.
 */
export function buildAgentMessages(
  targetAgent: RoomAgent,
  roomMessages: ChatMessage[],
  slidingWindowSize: number,
  options: BuildAgentMessagesOptions = {},
): AgentPrompt {
  const windowed = applySlidingWindow(roomMessages, slidingWindowSize);
  const merged: AgentPromptMessage[] = [];

  for (const message of windowed) {
    const isOwn = message.sender_type === "agent" && message.agent_id === targetAgent.id;
    const role: AgentPromptMessage["role"] = isOwn ? "assistant" : "user";
    const content = isOwn ? message.content : `[${speakerLabel(message)}]: ${message.content}`;

    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      merged.push({ role, content });
    }
  }

  if (merged.length === 0 || merged[0]?.role === "assistant") {
    merged.unshift({ role: "user", content: "[Moderator]: Die Debatte beginnt." });
  }
  if (merged[merged.length - 1]?.role === "assistant") {
    merged.push({
      role: "user",
      content: `[Moderator]: ${targetAgent.display_name}, du bist erneut an der Reihe. Vertiefe oder korrigiere deinen letzten Punkt.`,
    });
  }

  return { system: buildSystemPrompt(targetAgent, options), messages: merged };
}

/** Flacher Text-Transcript (für Router & Zusammenfassung). */
export function buildTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `[${speakerLabel(m)}]: ${m.content}`).join("\n\n");
}
