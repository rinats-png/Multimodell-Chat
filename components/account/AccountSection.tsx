"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

type PendingAction = "export" | "delete" | null;

/** Konto: Datenexport (Art. 20) und Löschung (Art. 17) mit erneuter Passwortbestätigung. */
export function AccountSection({ isDemoStore }: { isDemoStore: boolean }) {
  const router = useRouter();
  const [reauthFor, setReauthFor] = useState<PendingAction>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(action: Exclude<PendingAction, null>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = action === "export" ? await fetch("/api/account/export") : await fetch("/api/account", { method: "DELETE" });
      if (res.status === 403) {
        const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
        if (data.code === "reauth_required") return setReauthFor(action);
        return setMessage({ ok: false, text: data.error ?? "Nicht erlaubt" });
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return setMessage({ ok: false, text: data.error ?? "Das hat nicht geklappt." });
      }
      if (action === "export") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `multimodell-chat-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage({ ok: true, text: "Export heruntergeladen." });
      } else {
        router.push(isDemoStore ? "/chat" : "/login");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function reauth(e: React.FormEvent) {
    e.preventDefault();
    const action = reauthFor;
    if (!action) return;
    setBusy(true);
    const res = await fetch("/api/auth/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return setMessage({ ok: false, text: data.error ?? "Passwort nicht korrekt" });
    }
    setPassword("");
    setReauthFor(null);
    await run(action);
  }

  return (
    <section className="glass mt-6 rounded-2xl p-5" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-[15px] font-semibold">
        Konto & Daten
      </h2>
      <p className="mt-0.5 text-[13px] text-muted">Lade alle deine Daten herunter oder lösche dein Konto endgültig.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => run("export")}
          disabled={busy}
          className="btn-ghost px-3 py-2 text-[13px]"
        >
          <Download className="size-4" aria-hidden />
          Daten exportieren (JSON)
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 px-3 py-2 text-[13px] text-red-200 transition-colors hover:bg-red-500/10 disabled:opacity-60"
        >
          <Trash2 className="size-4" aria-hidden />
          Konto löschen
        </button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-3 text-[12.5px] ${message.ok ? "text-openai" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Konto endgültig löschen?">
        <div className="space-y-4 p-5 text-[13.5px] text-ink-2">
          <p>
            Alle Debatten, Agenten, Nachrichten und dein Profil werden sofort gelöscht. Ein laufendes Abo wird gekündigt. Das lässt
            sich nicht rückgängig machen.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost px-3 py-1.5">
              Abbrechen
            </button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                void run("delete");
              }}
              className="rounded-xl bg-gradient-to-b from-red-400 to-red-500 px-3 py-1.5 font-semibold text-white shadow-[0_8px_24px_-10px_rgb(248_113_113/0.8)] hover:brightness-110"
            >
              Endgültig löschen
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={reauthFor !== null} onClose={() => setReauthFor(null)} title="Passwort bestätigen" subtitle="Aus Sicherheitsgründen für diese Aktion nötig.">
        <form onSubmit={reauth} className="space-y-3 p-5">
          <label className="block text-[12.5px] text-muted">
            Passwort
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field mt-1 px-3 py-2 text-[14px]"
            />
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5 text-[13px]">
              Bestätigen
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
