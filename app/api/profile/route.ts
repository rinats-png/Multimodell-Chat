import { NextResponse } from "next/server";
import { handleApi, HttpError, limitMutations, readJson } from "@/lib/api";
import { isEncryptionConfigured } from "@/lib/crypto";
import { PLANS } from "@/lib/plans";
import { getSession, toPublicProfile } from "@/lib/session";
import { profilePatchSchema } from "@/lib/validation";

export async function GET() {
  return handleApi(async () => {
    const { store } = await getSession();
    return NextResponse.json({ profile: toPublicProfile(await store.getProfile()) });
  });
}

/** BYOK: eigenen OpenRouter-Key setzen oder entfernen (nur Workspace-Tarif, verschlüsselt gespeichert). */
export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { store, userId } = await getSession();
    await limitMutations(userId);
    const { custom_openrouter_key } = await readJson(request, profilePatchSchema);
    const profile = await store.getProfile();
    if (custom_openrouter_key && !PLANS[profile.subscription_tier].byok) {
      throw new HttpError(402, "plan_limit", "Eigene API-Keys sind im Workspace/BYOK-Tarif verfügbar.");
    }
    if (custom_openrouter_key && !isEncryptionConfigured()) {
      throw new HttpError(503, "not_configured", "Eigene Keys können gerade nicht sicher gespeichert werden.");
    }
    return NextResponse.json({ profile: toPublicProfile(await store.setCustomKey(custom_openrouter_key)) });
  });
}
