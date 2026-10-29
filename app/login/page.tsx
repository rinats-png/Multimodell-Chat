import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isSupabaseConfigured()) redirect("/chat");
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
