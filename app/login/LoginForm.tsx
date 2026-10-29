"use client";

import { MessagesSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createSupabaseBrowserClient();
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/chat");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/chat");
          router.refresh();
        } else {
          setMessage({ ok: true, text: "Fast geschafft – bestätige deine E-Mail über den Link in deinem Postfach." });
        }
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Anmeldung fehlgeschlagen" });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[14px] outline-none focus:border-accent/60";

  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-openai via-google to-anthropic">
          <MessagesSquare className="size-5 text-white" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{mode === "signin" ? "Willkommen zurück" : "Konto erstellen"}</h1>
        <p className="mt-1 text-[13px] text-muted">Debattiere mit ChatGPT, Claude und Gemini in einem Raum.</p>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3 rounded-2xl border border-line bg-surface p-5">
        <label className="block text-[12.5px] text-muted">
          E-Mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-[12.5px] text-muted">
          Passwort
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </label>
        {message && <p className={`text-[12.5px] ${message.ok ? "text-openai" : "text-red-400"}`}>{message.text}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-ink py-2 text-[13.5px] font-semibold text-canvas hover:bg-ink-2 disabled:opacity-60"
        >
          {busy ? "Bitte warten…" : mode === "signin" ? "Anmelden" : "Registrieren"}
        </button>
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">
        {mode === "signin" ? "Noch kein Konto?" : "Schon registriert?"}{" "}
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-accent-strong hover:underline">
          {mode === "signin" ? "Kostenlos starten" : "Anmelden"}
        </button>
      </p>
    </div>
  );
}
