"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";
import { AuthCard, inputCls, postJson } from "@/components/auth/AuthCard";

export default function PasswortNeuPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson("/api/auth/password", { password });
    setBusy(false);
    if (!ok) return setError(data.error ?? "Das Passwort konnte nicht gesetzt werden.");
    router.push("/chat");
    router.refresh();
  }

  return (
    <AuthCard title="Neues Passwort" subtitle="Danach werden alle anderen Geräte abgemeldet.">
      <form onSubmit={submit} className="glass-strong mt-8 space-y-3 rounded-2xl p-5">
        <label className="block text-[12.5px] text-muted">
          Neues Passwort
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
          <span className="mt-1 block text-[11.5px]">Mindestens {PASSWORD_MIN_LENGTH} Zeichen.</span>
        </label>
        {error && (
          <p role="alert" className="text-[12.5px] text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-[13.5px]">
          {busy ? "Bitte warten…" : "Passwort speichern"}
        </button>
      </form>
    </AuthCard>
  );
}
