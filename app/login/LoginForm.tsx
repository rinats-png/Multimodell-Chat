"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";
import { AuthCard, inputCls, postJson } from "@/components/auth/AuthCard";

interface LoginFormProps {
  linkInvalid: boolean;
  passwordChanged: boolean;
}

export function LoginForm({ linkInvalid, passwordChanged }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    linkInvalid
      ? { ok: false, text: "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an." }
      : passwordChanged
        ? { ok: true, text: "Passwort geändert. Bitte melde dich mit dem neuen Passwort an." }
        : null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { ok, data } = await postJson("/api/auth/login", { email, password });
        if (!ok) return setMessage({ ok: false, text: data.error ?? "Anmeldung fehlgeschlagen" });
        router.push("/chat");
        router.refresh();
      } else {
        const { ok, data } = await postJson("/api/auth/signup", { email, password, acceptTerms });
        if (!ok) return setMessage({ ok: false, text: data.error ?? "Registrierung fehlgeschlagen" });
        if (data.signedIn) {
          router.push("/chat");
          router.refresh();
        } else {
          setMessage({
            ok: true,
            text: "Fast geschafft – falls die Adresse noch nicht registriert ist, bekommst du gleich eine Bestätigungs-E-Mail.",
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";
  return (
    <AuthCard
      title={signup ? "Konto erstellen" : "Willkommen zurück"}
      subtitle="Debattiere mit ChatGPT, Claude und Gemini in einem Raum."
    >
      <form onSubmit={submit} className="glass-strong mt-8 space-y-3 rounded-2xl p-5" noValidate={false}>
        <label className="block text-[12.5px] text-muted">
          E-Mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-[12.5px] text-muted">
          Passwort
          <input
            type="password"
            required
            minLength={signup ? PASSWORD_MIN_LENGTH : 1}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            aria-describedby={signup ? "pw-hint" : undefined}
          />
          {signup && (
            <span id="pw-hint" className="mt-1 block text-[11.5px]">
              Mindestens {PASSWORD_MIN_LENGTH} Zeichen. Tipp: ein Satz aus mehreren Wörtern, gern mit Passwort-Manager.
            </span>
          )}
        </label>
        {signup && (
          <label className="flex items-start gap-2 text-[12.5px] text-ink-2">
            <input type="checkbox" required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
            <span>
              Ich habe die <Link href="/datenschutz" className="text-accent-strong underline">Datenschutzerklärung</Link> gelesen und weiß,
              dass meine Chat-Inhalte zur Beantwortung an KI-Anbieter übermittelt werden.
            </span>
          </label>
        )}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-[12.5px] ${message.ok ? "text-openai" : "text-red-300"}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || (signup && !acceptTerms)}
          className="btn-primary w-full py-2.5 text-[13.5px]"
        >
          {busy ? "Bitte warten…" : signup ? "Registrieren" : "Anmelden"}
        </button>
        {!signup && (
          <p className="text-center text-[12.5px]">
            <Link href="/passwort-vergessen" className="text-muted hover:text-ink-2 hover:underline">
              Passwort vergessen?
            </Link>
          </p>
        )}
      </form>
      <p className="mt-4 text-center text-[13px] text-muted">
        {signup ? "Schon registriert?" : "Noch kein Konto?"}{" "}
        <button
          onClick={() => {
            setMode(signup ? "signin" : "signup");
            setMessage(null);
          }}
          className="text-accent-strong hover:underline"
        >
          {signup ? "Anmelden" : "Kostenlos starten"}
        </button>
      </p>
    </AuthCard>
  );
}
