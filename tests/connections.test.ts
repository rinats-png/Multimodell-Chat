import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { PATCH as patchConnection } from "@/app/api/connections/route";
import { commandFor, createCliModel, flattenPrompt, isLocalSubscriptionMode, LocalCliError, runCli, ABO_MODELS } from "@/lib/ai/local-cli";
import { nativeModelId, resolveModelAccess } from "@/lib/ai/provider";
import { createPkce, exchangeCode, verifierFromCookie } from "@/lib/openrouter-oauth";
import { runOrchestration } from "@/lib/orchestrator";
import { toPublicProfile } from "@/lib/session";
import { createMemoryStore, memoryStore } from "@/lib/store/memory-store";
import { collector, jsonRequest, userMessage } from "./support/fixtures";

const ANTHROPIC_KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
const ENV = ["LOCAL_SUBSCRIPTION_MODE", "ABO_CMD_CLAUDE", "ABO_CMD_CHATGPT", "ABO_CMD_GEMINI", "ABO_CMD_KIMI"];

afterEach(() => {
  for (const name of ENV) delete process.env[name];
});

describe("Eigene Zugänge (F-13)", () => {
  it("TEST-F13-3: Anbieter-Key setzen, nur gekürzt zurückgeben, wieder entfernen", async () => {
    const res = await patchConnection(jsonRequest("/api/connections", "PATCH", { provider: "anthropic", key: ANTHROPIC_KEY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.connections).toEqual([{ id: "anthropic", hint: "sk-ant…wxyz" }]);
    expect(JSON.stringify(body)).not.toContain("abcdefghijklmnop");
    expect((await memoryStore.getProfile()).provider_keys.anthropic).toBe(ANTHROPIC_KEY);

    const removed = await patchConnection(jsonRequest("/api/connections", "PATCH", { provider: "anthropic", key: null }));
    expect((await removed.json()).profile.connections).toEqual([]);
  });

  it("TEST-F13-4: falsches Key-Format und unbekannte Anbieter werden abgelehnt", async () => {
    expect((await patchConnection(jsonRequest("/api/connections", "PATCH", { provider: "openai", key: "kein-key" }))).status).toBe(400);
    expect((await patchConnection(jsonRequest("/api/connections", "PATCH", { provider: "evil", key: ANTHROPIC_KEY }))).status).toBe(400);
    expect((await patchConnection(jsonRequest("/api/connections", "PATCH", { provider: "openai", key: "sk-abcdefghijklmnopqrstuv", extra: 1 }))).status).toBe(400);
  });

  it("T-SEC-36: ein anderer Nutzer sieht und nutzt fremde Keys nicht", async () => {
    await memoryStore.setProviderKey("anthropic", ANTHROPIC_KEY);
    await memoryStore.setCustomKey("sk-or-v1-abcdefghijklmnop");
    const other = createMemoryStore("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    const otherProfile = await other.getProfile();
    expect(otherProfile.provider_keys).toEqual({});
    expect(otherProfile.custom_openrouter_key).toBeNull();
    expect(resolveModelAccess(otherProfile, "anthropic/claude-sonnet-4.5", { allowPlatformKey: false }).source).toBe("demo");
    expect(toPublicProfile(otherProfile).connections).toEqual([]);
  });

  it("T-SEC-37: Keys liegen im Speicher nur verschlüsselt", async () => {
    await memoryStore.setProviderKey("openai", "sk-proj-abcdefghijklmnopqrstuvwxyz");
    const raw = JSON.stringify((globalThis as unknown as { __mmchatMemoryDbs: Map<string, unknown> }).__mmchatMemoryDbs.get("local"));
    expect(raw).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(raw).toContain('"provider_keys":"v1:');
  });

  it("wählt pro Modell den passenden Zugang: direkter Key vor OpenRouter vor Gateway", () => {
    const base = { subscription_tier: "free" as const, custom_openrouter_key: "sk-or-v1-abcdefghijklmnop" };
    const p = { ...base, provider_keys: { anthropic: ANTHROPIC_KEY, gateway: "vck_abcdefghijklmnopqrstuvwxyz" } };
    expect(resolveModelAccess(p, "anthropic/claude-sonnet-4.5", { allowPlatformKey: true })).toEqual({ source: "anthropic", apiKey: ANTHROPIC_KEY });
    expect(resolveModelAccess(p, "openai/gpt-5", { allowPlatformKey: true }).source).toBe("byok");
    expect(resolveModelAccess({ ...p, custom_openrouter_key: null }, "openai/gpt-5", { allowPlatformKey: true }).source).toBe("gateway");
  });

  it("übersetzt Modellnamen für direkte Anbieter", () => {
    expect(nativeModelId("anthropic/claude-sonnet-4.5", "anthropic")).toBe("claude-sonnet-4-5");
    expect(nativeModelId("openai/gpt-5-mini", "openai")).toBe("gpt-5-mini");
    expect(nativeModelId("x-ai/grok-4", "xai")).toBe("grok-4");
  });
});

describe("Mit OpenRouter verbinden (OAuth PKCE)", () => {
  it("Prüfwert und Challenge passen zusammen (S256)", () => {
    const pkce = createPkce();
    expect(pkce.challenge).toBe(createHash("sha256").update(pkce.verifier).digest("base64url"));
    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("T-SEC-38: Rückleitung nur mit passendem state", () => {
    const pkce = createPkce();
    expect(verifierFromCookie(pkce.cookieValue, pkce.state)).toBe(pkce.verifier);
    expect(verifierFromCookie(pkce.cookieValue, "fremder-state")).toBeNull();
    expect(verifierFromCookie(undefined, pkce.state)).toBeNull();
    expect(verifierFromCookie("kaputt", pkce.state)).toBeNull();
  });

  it("tauscht den Code gegen einen gültigen Key und lehnt Unsinn ab", async () => {
    const calls: unknown[] = [];
    // Ausgedachter Key, zusammengesetzt, damit der Secret-Scan ihn nicht für echt hält.
    const issued = ["sk-or-v1", "test".repeat(4)].join("-");
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ key: issued }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await exchangeCode("code123", "verifier456", fakeFetch)).toBe(issued);
    expect(calls[0]).toEqual({ code: "code123", code_verifier: "verifier456", code_challenge_method: "S256" });

    const badFetch = (async () => new Response(JSON.stringify({ key: "<script>" }), { status: 200 })) as unknown as typeof fetch;
    await expect(exchangeCode("c", "v", badFetch)).rejects.toThrow();
    const deniedFetch = (async () => new Response("{}", { status: 403 })) as unknown as typeof fetch;
    await expect(exchangeCode("c", "v", deniedFetch)).rejects.toThrow(/403/);
  });
});

describe("Lokaler Abo-Modus (CLI-Brücke)", () => {
  // Ersatz für claude/codex/gemini: liest den Prompt von stdin und antwortet mit einer Zeile.
  const fakeCli = (name: string) => JSON.stringify([process.execPath, "-e", `let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write("${name} antwortet auf "+s.length+" Zeichen"))`]);

  it("ist nur mit Schalter, außerhalb der Produktion und ohne Supabase aktiv", () => {
    expect(isLocalSubscriptionMode()).toBe(false);
    process.env.LOCAL_SUBSCRIPTION_MODE = "true";
    expect(isLocalSubscriptionMode()).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    expect(isLocalSubscriptionMode()).toBe(false);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("T-SEC-39: ohne Schalter laufen Abo-Modelle nie über ein lokales Programm", () => {
    const p = { subscription_tier: "free" as const, custom_openrouter_key: null, provider_keys: {} };
    expect(resolveModelAccess(p, "abo/claude", { allowPlatformKey: true }).source).toBe("demo");
    process.env.LOCAL_SUBSCRIPTION_MODE = "true";
    expect(resolveModelAccess(p, "abo/claude", { allowPlatformKey: true }).source).toBe("local");
  });

  it("Prompt geht über stdin, Ausgabe kommt zurück; fehlendes Programm wird erkannt", async () => {
    const out = await runCli([process.execPath, "-e", "process.stdin.pipe(process.stdout)"], "Hallo $(rm -rf /) `id`");
    expect(out).toBe("Hallo $(rm -rf /) `id`");
    await expect(runCli(["gibt-es-nicht-mm-chat"], "x")).rejects.toMatchObject({ reason: "not_found" });
    await expect(runCli([process.execPath, "-e", "process.exit(3)"], "x")).rejects.toBeInstanceOf(LocalCliError);
  });

  it("Befehl lässt sich per Umgebung überschreiben", () => {
    const claude = ABO_MODELS.find((m) => m.id === "abo/claude")!;
    expect(commandFor(claude)).toEqual(["claude", "-p", "--output-format", "text"]);
    process.env.ABO_CMD_CLAUDE = "claude -p --model sonnet";
    expect(commandFor(claude)).toEqual(["claude", "-p", "--model", "sonnet"]);
    process.env.ABO_CMD_CLAUDE = '["my claude","-p"]';
    expect(commandFor(claude)).toEqual(["my claude", "-p"]);
  });

  it("macht aus dem Chat-Verlauf einen Text mit Rollen und Aufgabe", () => {
    const text = flattenPrompt([
      { role: "system", content: "Du bist Claude." },
      { role: "user", content: [{ type: "text", text: "[Du]: Preise erhöhen?" }] },
      { role: "assistant", content: [{ type: "text", text: "Lieber nicht." }] },
    ]);
    expect(text).toContain("Du bist Claude.");
    expect(text).toContain("[Du]: Preise erhöhen?");
    expect(text).toContain("[Deine frühere Antwort]: Lieber nicht.");
    expect(createCliModel("abo/claude").provider).toBe("local-cli");
  });

  it("TEST-F20-1: Debatte mit vier Abo-Agenten ohne Key, ohne Kontingent-Buchung", async () => {
    process.env.LOCAL_SUBSCRIPTION_MODE = "true";
    process.env.ABO_CMD_CHATGPT = fakeCli("ChatGPT");
    process.env.ABO_CMD_CLAUDE = fakeCli("Claude");
    process.env.ABO_CMD_GEMINI = fakeCli("Gemini");
    process.env.ABO_CMD_KIMI = fakeCli("Kimi");
    const room = await memoryStore.createRoom("Abo");
    await memoryStore.updateRoom(room.id, { orchestration_mode: "round-robin", max_auto_turns: 4 });
    const agents = await memoryStore.listAgents(room.id);
    expect(agents.map((a) => a.model_identifier)).toEqual(["abo/chatgpt", "abo/claude", "abo/gemini", "abo/kimi"]);

    const msg = await userMessage(room.id, "Sollen wir die Preise erhöhen?");
    const { events, emit } = collector();
    const fresh = (await memoryStore.getRoom(room.id))!;
    await runOrchestration({ store: memoryStore, room: fresh, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });

    expect(events.filter((e) => e.type === "error")).toEqual([]);
    const replies = (await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent");
    expect(replies.map((m) => m.content.split(" ")[0])).toEqual(["ChatGPT", "Claude", "Gemini", "Kimi"]);
    expect(replies.every((m) => m.estimated_cost_usd === 0)).toBe(true);
    expect((await memoryStore.getProfile()).tokens_used_this_month).toBe(0);
  });

  it("fehlendes Programm ergibt eine verständliche Meldung statt eines Absturzes", async () => {
    process.env.LOCAL_SUBSCRIPTION_MODE = "true";
    process.env.ABO_CMD_CHATGPT = '["gibt-es-nicht-mm-chat"]';
    const room = await memoryStore.createRoom("Abo");
    await memoryStore.updateRoom(room.id, { orchestration_mode: "round-robin" });
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "Test");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room: (await memoryStore.getRoom(room.id))!, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: false, emit, signal: new AbortController().signal });
    const error = events.find((e) => e.type === "error");
    expect(error && "message" in error ? error.message : "").toMatch(/nicht gefunden.*Installiere/);
  });
});
