import { NextResponse } from "next/server";
import { handleApi, HttpError, limitMutations, readJson } from "@/lib/api";
import { isEncryptionConfigured } from "@/lib/crypto";
import { securityLog } from "@/lib/log";
import { PLANS } from "@/lib/plans";
import { getSession, toPublicProfile } from "@/lib/session";
import { connectionPatchSchema } from "@/lib/validation";

/** Eigenen Zugang setzen oder entfernen: OpenRouter, Vercel AI Gateway, OpenAI, Anthropic, Google, xAI. */
export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { store, userId } = await getSession();
    await limitMutations(userId);
    const { provider, key } = await readJson(request, connectionPatchSchema);
    const profile = await store.getProfile();
    if (key && !PLANS[profile.subscription_tier].byok) {
      throw new HttpError(402, "plan_limit", "Eigene Zugänge sind in deinem Tarif nicht verfügbar.");
    }
    if (key && !isEncryptionConfigured()) {
      throw new HttpError(503, "not_configured", "Eigene Keys können gerade nicht sicher gespeichert werden.");
    }
    const updated = provider === "openrouter" ? await store.setCustomKey(key) : await store.setProviderKey(provider, key);
    securityLog(key ? "connection_set" : "connection_removed", { userId, provider });
    return NextResponse.json({ profile: toPublicProfile(updated) });
  });
}
