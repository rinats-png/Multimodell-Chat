import { describe, expect, it } from "vitest";
import { groupModelsByProvider, MODEL_CATALOG, providerGroupLabel } from "@/lib/models";

describe("Modellauswahl nach Anbieter", () => {
  it("benennt bekannte Anbieter und zeigt unbekannte mit ihrem Kürzel", () => {
    expect(providerGroupLabel("anthropic/claude-sonnet-4.5")).toBe("Anthropic (Claude)");
    expect(providerGroupLabel("x-ai/grok-4")).toBe("xAI (Grok)");
    expect(providerGroupLabel("abo/claude")).toBe("Eigenes Abo (lokal)");
    expect(providerGroupLabel("neuer-anbieter/modell-1")).toBe("neuer-anbieter");
  });

  it("gruppiert in der Reihenfolge der Eingabe und verliert kein Modell", () => {
    const groups = groupModelsByProvider(MODEL_CATALOG);
    expect(groups.flatMap((g) => g.models).length).toBe(MODEL_CATALOG.length);
    expect(new Set(groups.map((g) => g.label)).size).toBe(groups.length);
    expect(groups[0]?.label).toBe("OpenAI (ChatGPT)");
    expect(groups[0]?.models.every((m) => m.id.startsWith("openai/"))).toBe(true);
  });
});
