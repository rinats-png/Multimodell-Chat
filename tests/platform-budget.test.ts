import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Modellaufruf ersetzen: kein Netz, feste Token-Zahlen (Eingabe 1.000, Ausgabe 500).
vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return {
    ...original,
    streamText: () => ({
      textStream: (async function* () {
        yield "Eine kurze Antwort.";
      })(),
      usage: Promise.resolve({ inputTokens: 1000, outputTokens: 500 }),
    }),
  };
});

import { estimateCostUsd } from "@/lib/models";
import { runOrchestration } from "@/lib/orchestrator";
import { assertPlatformBudget, DEFAULT_MONTHLY_CAP_EUR, DEFAULT_USD_PER_EUR, platformBudget, platformBudgetAllows } from "@/lib/platform-budget";
import { memoryStore, resetMemoryDb, resetPlatformSpend } from "@/lib/store/memory-store";
import { UsageGuardError } from "@/lib/usage-guard";
import { collector, demoRoom, userMessage } from "./support/fixtures";

const ENV = ["PLATFORM_KEY_MONTHLY_CAP_EUR", "PLATFORM_KEY_TRIAL_SHARE", "PLATFORM_KEY_USD_PER_EUR", "OPENROUTER_API_KEY"] as const;

beforeEach(() => {
  resetMemoryDb();
  resetPlatformSpend();
});
afterEach(() => {
  for (const name of ENV) delete process.env[name];
});

describe("Ausgabenobergrenze für den Plattform-Key (T-SEC-40)", () => {
  it("Standard: 50 EUR im Monat, davon 40 % für Testnutzer, in USD umgerechnet", () => {
    const b = platformBudget();
    expect(b.totalUsd).toBeCloseTo(DEFAULT_MONTHLY_CAP_EUR * DEFAULT_USD_PER_EUR, 6);
    expect(b.trialUsd).toBeCloseTo(b.totalUsd * 0.4, 6);
  });

  it("Werte aus der Umgebung gelten; ungültige Werte fallen auf den sicheren Standard zurück", () => {
    process.env.PLATFORM_KEY_MONTHLY_CAP_EUR = "20";
    process.env.PLATFORM_KEY_USD_PER_EUR = "1";
    process.env.PLATFORM_KEY_TRIAL_SHARE = "0.5";
    expect(platformBudget()).toEqual({ totalUsd: 20, trialUsd: 10 });
    process.env.PLATFORM_KEY_MONTHLY_CAP_EUR = "viel";
    process.env.PLATFORM_KEY_TRIAL_SHARE = "7";
    process.env.PLATFORM_KEY_USD_PER_EUR = "-3";
    expect(platformBudget().totalUsd).toBeCloseTo(DEFAULT_MONTHLY_CAP_EUR * DEFAULT_USD_PER_EUR, 6);
    expect(platformBudget().trialUsd / platformBudget().totalUsd).toBeCloseTo(0.4, 6);
  });

  it("Testnutzer stoppen früher als zahlende Kunden; die Gesamtgrenze stoppt alle", () => {
    const budget = { totalUsd: 55, trialUsd: 22 };
    const free = { subscription_tier: "free" as const };
    const pro = { subscription_tier: "pro" as const };
    expect(platformBudgetAllows({ trial_usd: 0, paid_usd: 0 }, free, budget)).toBe(true);
    // Der Testtopf ist leer: Starter gestoppt, Pro läuft weiter
    expect(platformBudgetAllows({ trial_usd: 22, paid_usd: 0 }, free, budget)).toBe(false);
    expect(platformBudgetAllows({ trial_usd: 22, paid_usd: 0 }, pro, budget)).toBe(true);
    // Gesamtgrenze erreicht: niemand mehr
    expect(platformBudgetAllows({ trial_usd: 10, paid_usd: 45 }, pro, budget)).toBe(false);
    expect(platformBudgetAllows({ trial_usd: 10, paid_usd: 45 }, free, budget)).toBe(false);
  });

  it("assertPlatformBudget wirft einen verständlichen 503-Fehler mit Hinweis auf den eigenen Zugang", async () => {
    await memoryStore.addPlatformSpend(platformBudget().totalUsd, false);
    const error = await assertPlatformBudget(memoryStore, { subscription_tier: "pro" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsageGuardError);
    expect(error).toMatchObject({ code: "budget_exhausted", status: 503 });
    expect((error as Error).message).toMatch(/eigenen API-Key|OpenRouter-Konto/);
  });

  it("Orchestrator: bei erreichter Obergrenze entsteht kein Modellaufruf und nichts wird gebucht", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    await memoryStore.addPlatformSpend(platformBudget().totalUsd, true);
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "@Claude was meinst du?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: true, emit, signal: new AbortController().signal });
    const error = events.find((e) => e.type === "error");
    expect(error && "code" in error && error.code).toBe("budget_exhausted");
    expect((await memoryStore.listMessages(room.id)).filter((m) => m.sender_type === "agent")).toHaveLength(0);
    expect((await memoryStore.getProfile()).tokens_used_this_month).toBe(0);
  });

  it("Orchestrator: eine Antwort mit dem Plattform-Key wird gegen den Testtopf gebucht", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const claude = agents.find((a) => a.display_name === "Claude")!;
    const msg = await userMessage(room.id, "@Claude was meinst du?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: true, emit, signal: new AbortController().signal });
    expect(events.find((e) => e.type === "error")).toBeUndefined();
    const spend = await memoryStore.getPlatformSpend();
    expect(spend.trial_usd).toBeCloseTo(estimateCostUsd(claude.model_identifier, 1000, 500), 6);
    expect(spend.paid_usd).toBe(0);
    expect((await memoryStore.getProfile()).tokens_used_this_month).toBe(1500);
  });

  it("Orchestrator: zahlende Kunden buchen in den bezahlten Topf und laufen weiter, wenn nur der Testtopf leer ist", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    await memoryStore.setTier!("pro");
    await memoryStore.addPlatformSpend(platformBudget().trialUsd, true);
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "@Claude was meinst du?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: true, emit, signal: new AbortController().signal });
    expect(events.find((e) => e.type === "error")).toBeUndefined();
    expect((await memoryStore.getPlatformSpend()).paid_usd).toBeGreaterThan(0);
  });

  it("Eigener Zugang zählt nicht gegen die Obergrenze", async () => {
    await memoryStore.setCustomKey("sk-or-v1-abcdefghijklmnop");
    await memoryStore.addPlatformSpend(platformBudget().totalUsd, false);
    const room = await demoRoom("round-robin");
    const agents = await memoryStore.listAgents(room.id);
    const msg = await userMessage(room.id, "@Claude was meinst du?");
    const { events, emit } = collector();
    await runOrchestration({ store: memoryStore, room, agents, forcedAgentId: null, userMessage: msg, allowPlatformKey: true, emit, signal: new AbortController().signal });
    expect(events.find((e) => e.type === "error")).toBeUndefined();
    expect(await memoryStore.getPlatformSpend()).toEqual({ trial_usd: 0, paid_usd: platformBudget().totalUsd });
  });
});
