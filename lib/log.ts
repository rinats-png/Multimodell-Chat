/**
 * Protokollierung ohne Inhalte (Regel 7.2, BF-30): Es werden nie Prompts, Nachrichten,
 * Schlüssel oder Request-Bodies geloggt – nur Typ, Status und Kennungen.
 */

type Details = Record<string, string | number | boolean | null | undefined>;

export function securityLog(event: string, details: Details = {}): void {
  console.warn(JSON.stringify({ level: "security", event, at: new Date().toISOString(), ...details }));
}

interface ErrorLike {
  name?: unknown;
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
}

/** Fehler sicher zusammenfassen: keine Bodies, Fehlermeldung gekürzt. */
export function describeError(error: unknown): Details {
  if (!error || typeof error !== "object") return { error: String(error).slice(0, 200) };
  const e = error as ErrorLike;
  return {
    name: typeof e.name === "string" ? e.name : "Error",
    status: typeof e.statusCode === "number" ? e.statusCode : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    message: typeof e.message === "string" ? e.message.slice(0, 200) : undefined,
  };
}

export function logError(scope: string, error: unknown, details: Details = {}): void {
  console.error(JSON.stringify({ level: "error", scope, at: new Date().toISOString(), ...details, ...describeError(error) }));
}
