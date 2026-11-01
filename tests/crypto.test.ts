import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("BYOK-Verschlüsselung (F-13)", () => {
  it("TEST-F13-1: speichert den Key nur verschlüsselt und entschlüsselt ihn wieder (T-SEC-10)", () => {
    const stored = encryptSecret("sk-or-v1-geheim-1234567890");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("geheim");
    expect(decryptSecret(stored)).toBe("sk-or-v1-geheim-1234567890");
  });

  it("T-SEC-10: manipulierter Wert wird abgelehnt", () => {
    const stored = encryptSecret("sk-or-v1-geheim-1234567890");
    const parts = stored.split(":");
    parts[3] = Buffer.from("anders").toString("base64url");
    expect(decryptSecret(parts.join(":"))).toBeNull();
    expect(decryptSecret("sk-or-klartext")).toBeNull();
  });
});
