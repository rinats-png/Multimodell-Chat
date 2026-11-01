import { NextResponse } from "next/server";
import { handleApi } from "@/lib/api";
import { assertAuthAvailable } from "@/lib/auth-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Abmelden: widerruft die Sitzung serverseitig und löscht die Cookies (Regel 3.6). */
export async function POST() {
  return handleApi(async () => {
    assertAuthAvailable();
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  });
}
