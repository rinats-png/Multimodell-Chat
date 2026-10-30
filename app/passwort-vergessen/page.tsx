"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, inputCls, postJson } from "@/components/auth/AuthCard";

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await postJson("/api/auth/reset", { email });
    setBusy(false);
    setMessage(
      ok
        ? { ok: true, text: "Wenn ein Konto mit dieser Adresse existiert, bekommst du gleich eine E-Mail mit einem Link (gültig für kurze Zeit)." }
        : { ok: false, text: data.error ?? "Das hat nicht geklappt. Bitte später erneut versuchen." },
    );
  }

  return (
    <AuthCard title="Passwort zurücksetzen" subtitle="Wir schicken dir einen Link für ein neues Passwort.">
      <form onSubmit={submit} className="glass-strong mt-8 space-y-3 rounded-2xl p-5">
        <label className="block text-[12.5px] text-muted">
          E-Mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-[12.5px] ${message.ok ? "text-openai" : "text-red-300"}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-[13.5px]">
          {busy ? "Bitte warten…" : "Link anfordern"}
        </button>
      </form>
      <p className="mt-4 text-center text-[13px]">
        <Link href="/login" className="text-accent-strong hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </AuthCard>
  );
}
