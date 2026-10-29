import { NextResponse } from "next/server";
import { handleApi, jsonError } from "@/lib/api";
import { getSession, toPublicProfile } from "@/lib/session";
import { profilePatchSchema } from "@/lib/validation";

export async function GET() {
  return handleApi(async () => {
    const { store } = await getSession();
    return NextResponse.json({ profile: toPublicProfile(await store.getProfile()) });
  });
}

/** BYOK: eigenen OpenRouter-Key setzen oder entfernen (nur Workspace-Tarif). */
export async function PATCH(request: Request) {
  return handleApi(async () => {
    const { store } = await getSession();
    const { custom_openrouter_key } = profilePatchSchema.parse(await request.json());
    const profile = await store.getProfile();
    if (custom_openrouter_key && profile.subscription_tier !== "team") {
      return jsonError("Eigene API-Keys sind im Workspace/BYOK-Tarif verfügbar.", 402, "plan_limit");
    }
    return NextResponse.json({ profile: toPublicProfile(await store.setCustomKey(custom_openrouter_key)) });
  });
}
