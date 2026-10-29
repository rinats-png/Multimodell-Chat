import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./session";

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Einheitliches Fehler-Mapping für alle Route-Handler. */
export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(error.message, 401, "unauthorized");
    if (error instanceof ZodError) return jsonError(error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), 400, "invalid_input");
    console.error("[api]", error);
    return jsonError(error instanceof Error ? error.message : "Interner Fehler", 500, "internal");
  }
}
