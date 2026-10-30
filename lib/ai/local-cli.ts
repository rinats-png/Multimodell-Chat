import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2Prompt, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ABO_MODEL_LIST, approxTokens } from "../models";
import { isSupabaseConfigured } from "../supabase/config";

/**
 * Lokaler Abo-Modus (nur für den eigenen Rechner): Statt eines API-Keys ruft die App die
 * Kommandozeilen-Programme der Anbieter auf, in denen du mit deinem Abo angemeldet bist
 * (Claude Code, Codex, Gemini CLI, Kimi CLI). Der Prompt geht ausschließlich über stdin –
 * nie als Argument –, das Programm läuft in einem leeren Arbeitsordner.
 *
 * Aktiv nur mit LOCAL_SUBSCRIPTION_MODE=true, im Entwicklungsmodus und ohne Supabase
 * (Einzelplatz-Demo). Ein öffentlich erreichbarer Server darf niemals fremde Anfragen
 * über das Abo des Betreibers ausführen.
 */

export const ABO_PREFIX = "abo/";

const labelOf = (id: string) => ABO_MODEL_LIST.find((m) => m.id === id)?.label ?? id;

export interface AboModel {
  id: string;
  label: string;
  /** Anbieterfarbe in der Oberfläche */
  provider: "openai" | "anthropic" | "google" | "other";
  /** Umgebungsvariable, mit der sich der Befehl überschreiben lässt */
  envVar: string;
  defaultCommand: string[];
  install: string;
}

export const ABO_MODELS: AboModel[] = [
  {
    id: "abo/claude",
    label: labelOf("abo/claude"),
    provider: "anthropic",
    envVar: "ABO_CMD_CLAUDE",
    defaultCommand: ["claude", "-p", "--output-format", "text"],
    install: "npm install -g @anthropic-ai/claude-code, dann einmal `claude` starten und anmelden",
  },
  {
    id: "abo/chatgpt",
    label: labelOf("abo/chatgpt"),
    provider: "openai",
    envVar: "ABO_CMD_CHATGPT",
    defaultCommand: ["codex", "exec", "--skip-git-repo-check", "--sandbox", "read-only", "-"],
    install: "npm install -g @openai/codex, dann `codex login` (Mit ChatGPT anmelden)",
  },
  {
    id: "abo/gemini",
    label: labelOf("abo/gemini"),
    provider: "google",
    envVar: "ABO_CMD_GEMINI",
    defaultCommand: ["gemini"],
    install: "npm install -g @google/gemini-cli, dann einmal `gemini` starten und mit Google anmelden",
  },
  {
    id: "abo/kimi",
    label: labelOf("abo/kimi"),
    provider: "other",
    envVar: "ABO_CMD_KIMI",
    defaultCommand: ["kimi", "--print"],
    install: "Kimi CLI installieren und anmelden; Befehl bei Bedarf in ABO_CMD_KIMI anpassen",
  },
];

export function isAboModel(modelId: string): boolean {
  return modelId.startsWith(ABO_PREFIX);
}

export function aboModel(modelId: string): AboModel | undefined {
  return ABO_MODELS.find((m) => m.id === modelId);
}

export function isLocalSubscriptionMode(): boolean {
  return process.env.LOCAL_SUBSCRIPTION_MODE === "true" && process.env.NODE_ENV !== "production" && !isSupabaseConfigured();
}

/** Befehl aus der Umgebung: JSON-Array (["kimi","--print"]) oder durch Leerzeichen getrennt. */
export function commandFor(model: AboModel): string[] {
  const raw = process.env[model.envVar]?.trim();
  if (!raw) return model.defaultCommand;
  if (raw.startsWith("[")) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((p) => typeof p === "string")) {
      throw new Error(`${model.envVar} muss ein JSON-Array aus Texten sein`);
    }
    return parsed as string[];
  }
  return raw.split(/\s+/);
}

/** Verlauf in Textform: Die CLIs kennen keine Rollen, nur einen Eingabetext. */
export function flattenPrompt(prompt: LanguageModelV2Prompt): string {
  const parts: string[] = [];
  const history: string[] = [];
  for (const message of prompt) {
    if (message.role === "system") {
      parts.push(message.content);
      continue;
    }
    const text = message.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    if (!text) continue;
    history.push(message.role === "assistant" ? `[Deine frühere Antwort]: ${text}` : text);
  }
  return [
    "# Deine Rolle und Regeln",
    parts.join("\n\n"),
    "",
    "# Bisheriger Gruppenchat",
    history.join("\n\n") || "(noch leer)",
    "",
    "# Aufgabe",
    "Antworte jetzt mit deinem nächsten Beitrag in diesem Gruppenchat. Nur der Beitrag selbst – ohne Namenspräfix, " +
      "ohne Werkzeuge zu benutzen und ohne Dateien zu lesen oder zu ändern.",
  ].join("\n");
}

function workDir(): string {
  const dir = join(tmpdir(), "multimodell-abo");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export class LocalCliError extends Error {
  constructor(
    message: string,
    public readonly reason: "not_found" | "failed" | "timeout",
  ) {
    super(message);
  }
}

const TIMEOUT_MS = () => Number(process.env.ABO_TIMEOUT_MS ?? 240_000);

/** Startet das Programm, schreibt den Prompt auf stdin und liefert stdout stückweise. */
export function runCli(command: string[], input: string, signal?: AbortSignal, onChunk?: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command;
    // Windows: npm-Programme sind .cmd-Dateien und brauchen eine Shell. Die Argumente sind
    // feste Werte aus der Konfiguration – Nutzertext geht nur über stdin.
    const child = spawn(cmd!, args, {
      cwd: workDir(),
      env: process.env,
      shell: process.platform === "win32",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onAbort = () => {
      child.kill();
      finish(() => reject(signal?.reason ?? new Error("abgebrochen")));
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new LocalCliError(`${cmd} hat nicht rechtzeitig geantwortet`, "timeout")));
    }, TIMEOUT_MS());
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
      onChunk?.(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      err = (err + chunk).slice(-2_000);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          error.code === "ENOENT"
            ? new LocalCliError(`Programm „${cmd}“ nicht gefunden`, "not_found")
            : new LocalCliError(`${cmd}: ${error.message}`, "failed"),
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0 && out.trim()) finish(() => resolve(out));
      else finish(() => reject(new LocalCliError(`${cmd} beendet mit Code ${code}: ${err.trim().slice(-300) || "keine Ausgabe"}`, "failed")));
    });
    child.stdin.on("error", () => {
      // Programm hat stdin vorzeitig geschlossen – Fehler kommt über "close".
    });
    child.stdin.end(input);
  });
}

/** LanguageModelV2 über ein lokales CLI – damit laufen Streaming, Ledger und UI unverändert. */
export function createCliModel(modelId: string): LanguageModelV2 {
  const model = aboModel(modelId);
  if (!model) throw new LocalCliError(`Unbekanntes Abo-Modell ${modelId}`, "failed");

  const usage = (input: string, output: string) => {
    const inputTokens = approxTokens(input);
    const outputTokens = approxTokens(output);
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  };

  return {
    specificationVersion: "v2",
    provider: "local-cli",
    modelId,
    supportedUrls: {},
    async doGenerate(options: LanguageModelV2CallOptions) {
      const input = flattenPrompt(options.prompt);
      const text = (await runCli(commandFor(model), input, options.abortSignal)).trim();
      return { content: [{ type: "text", text }], finishReason: "stop", usage: usage(input, text), warnings: [] };
    },
    async doStream(options: LanguageModelV2CallOptions) {
      const input = flattenPrompt(options.prompt);
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        async start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "t0" });
          try {
            const text = await runCli(commandFor(model), input, options.abortSignal, (chunk) =>
              controller.enqueue({ type: "text-delta", id: "t0", delta: chunk }),
            );
            controller.enqueue({ type: "text-end", id: "t0" });
            controller.enqueue({ type: "finish", finishReason: "stop", usage: usage(input, text) });
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });
      return { stream };
    },
  };
}

export interface CliStatus {
  id: string;
  label: string;
  command: string;
  found: boolean;
  install: string;
}

/** Prüft, ob die Programme installiert sind (`--version`), ohne ein Modell aufzurufen. */
export async function checkCliStatus(): Promise<CliStatus[]> {
  return Promise.all(
    ABO_MODELS.map(async (model) => {
      let command: string[];
      try {
        command = commandFor(model);
      } catch {
        return { id: model.id, label: model.label, command: "(ungültig)", found: false, install: model.install };
      }
      const found = await new Promise<boolean>((resolve) => {
        const child = spawn(command[0]!, ["--version"], { shell: process.platform === "win32", windowsHide: true, stdio: "ignore" });
        const timer = setTimeout(() => {
          child.kill();
          resolve(false);
        }, 8_000);
        child.on("error", () => {
          clearTimeout(timer);
          resolve(false);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve(code === 0);
        });
      });
      return { id: model.id, label: model.label, command: command.join(" "), found, install: model.install };
    }),
  );
}
