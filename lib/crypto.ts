import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { isProduction } from "./env";
import { PROVIDER_KEY_IDS, type ProviderKeys } from "./types";

/**
 * Verschlüsselung des BYOK-Keys at rest (BF-08) mit AES-256-GCM aus Node `crypto`.
 * Format: v1:<iv b64url>:<tag b64url>:<ciphertext b64url>
 * Schlüssel: BYOK_ENCRYPTION_KEY = 32 Byte, base64 (z. B. `openssl rand -base64 32`).
 */

const PREFIX = "v1";
// Fester Entwicklungsschlüssel: nur lokal ohne Produktionsdaten. In Produktion Pflicht-Variable.
const DEV_KEY = Buffer.alloc(32, 7);

export class EncryptionUnavailableError extends Error {
  constructor() {
    super("BYOK_ENCRYPTION_KEY fehlt oder ist ungültig");
  }
}

function getKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (!raw) {
    if (isProduction()) throw new EncryptionUnavailableError();
    return DEV_KEY;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new EncryptionUnavailableError();
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

/** Liefert null bei Manipulation, falschem Schlüssel oder unbekanntem Format. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [prefix, iv, tag, data] = stored.split(":");
  if (prefix !== PREFIX || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    console.error("[crypto] BYOK-Key konnte nicht entschlüsselt werden");
    return null;
  }
}

/** Weitere eigene Keys als ein verschlüsselter JSON-Wert (Spalte provider_keys). */
export function encryptProviderKeys(keys: ProviderKeys): string | null {
  const clean = Object.fromEntries(Object.entries(keys).filter(([, v]) => typeof v === "string" && v.trim()));
  return Object.keys(clean).length > 0 ? encryptSecret(JSON.stringify(clean)) : null;
}

export function decryptProviderKeys(stored: string | null | undefined): ProviderKeys {
  const plain = decryptSecret(stored);
  if (!plain) return {};
  try {
    const parsed: unknown = JSON.parse(plain);
    if (!parsed || typeof parsed !== "object") return {};
    const result: ProviderKeys = {};
    for (const id of PROVIDER_KEY_IDS) {
      const value = (parsed as Record<string, unknown>)[id];
      if (typeof value === "string" && value.trim()) result[id] = value;
    }
    return result;
  } catch {
    return {};
  }
}
