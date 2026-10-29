import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { approxTokens } from "../models";

/**
 * Lokales Sprachmodell für den Demo-Modus (kein OpenRouter-Key gesetzt).
 * Implementiert das LanguageModelV2-Interface, damit die komplette Pipeline
 * (streamText, Usage-Tracking, Ledger) identisch zum Produktivbetrieb läuft.
 */
export function createDemoModel(modelId: string, responseText: string, promptText: string): LanguageModelV2 {
  const usage = () => {
    const inputTokens = approxTokens(promptText);
    const outputTokens = approxTokens(responseText);
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  };

  return {
    specificationVersion: "v2",
    provider: "demo",
    modelId,
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: "text", text: responseText }],
        finishReason: "stop",
        usage: usage(),
        warnings: [],
      };
    },
    async doStream() {
      const chunks = responseText.match(/\S+\s*/g) ?? [responseText];
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        async start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "t0" });
          for (const chunk of chunks) {
            await new Promise((resolve) => setTimeout(resolve, 18));
            controller.enqueue({ type: "text-delta", id: "t0", delta: chunk });
          }
          controller.enqueue({ type: "text-end", id: "t0" });
          controller.enqueue({ type: "finish", finishReason: "stop", usage: usage() });
          controller.close();
        },
      });
      return { stream };
    },
  };
}

interface DemoReplyInput {
  agentName: string;
  roleTitle: string;
  modelId: string;
  lastSpeaker: string | null;
  lastContent: string;
}

function topicOf(text: string): string {
  const clean = text.replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "dieses Thema";
  return clean.length > 80 ? `„${clean.slice(0, 77)}…“` : `„${clean}“`;
}

/** Rollen-typische Demo-Antwort, damit Orchestrierung & UI ohne Keys erlebbar sind. */
export function composeDemoReply({ agentName, roleTitle, modelId, lastSpeaker, lastContent }: DemoReplyInput): string {
  const topic = topicOf(lastContent);
  const addressee = lastSpeaker && lastSpeaker !== agentName ? lastSpeaker : null;
  const provider = modelId.split("/")[0];

  if (provider === "anthropic" || /kritisch|devil|architekt/i.test(roleTitle)) {
    return (
      `${addressee ? `${addressee}, da` : "Da"} muss ich widersprechen. Bei ${topic} sehe ich drei Risiken, die bisher niemand adressiert:\n\n` +
      "1. **Skalierung** – der Ansatz funktioniert für 100 Nutzer, aber nicht für 100.000 ohne Caching-Schicht.\n" +
      "2. **Sicherheit** – Nutzereingaben fließen ungeprüft in nachgelagerte Systeme.\n" +
      "3. **Kosten** – der Kontext wächst linear pro Turn, die Kosten damit quadratisch.\n\n" +
      "Robustere Alternative: erst einen schmalen, abgesicherten Kern bauen und Limits von Anfang an messen. " +
      "_(Demo-Modus – simulierte Antwort)_"
    );
  }
  if (provider === "google" || /synth|querdenk|kreativ/i.test(roleTitle)) {
    return (
      `Lasst mich ${topic} aus einem anderen Blickwinkel betrachten. Spotify hat ein ähnliches Problem gelöst, ` +
      "indem es nicht das Produkt, sondern die *Gewohnheit* des Nutzers in den Mittelpunkt gestellt hat.\n\n" +
      `**Fazit:** ${addressee ? `${addressee}s Punkt` : "Der Pragmatismus"} und die Bedenken zur Robustheit schließen sich nicht aus – ` +
      "ein zweistufiger Plan (schneller Pilot + harte Leitplanken) verbindet beides. _(Demo-Modus – simulierte Antwort)_"
    );
  }
  return (
    `Pragmatisch betrachtet${addressee ? `, ${addressee}` : ""}: Für ${topic} würde ich in zwei Wochen einen MVP ausliefern.\n\n` +
    "- **Scope:** nur der Kern-Use-Case, alles andere auf die Roadmap\n" +
    "- **KPI:** Aktivierungsrate in Woche 1\n" +
    "- **Nächster Schritt:** 5 Nutzerinterviews diese Woche\n\n" +
    `Theorie können wir danach optimieren – erst brauchen wir echte Daten. _(Demo-Modus – simulierte Antwort, ${agentName})_`
  );
}
