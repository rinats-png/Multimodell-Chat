import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ link?: string; reset?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/chat");
  const params = await searchParams;
  return <LoginForm linkInvalid={params.link === "ungueltig"} passwordChanged={params.reset === "ok"} />;
}
