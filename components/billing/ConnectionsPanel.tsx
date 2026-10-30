"use client";

import clsx from "clsx";
import { CheckCircle2, CircleDashed, ExternalLink, KeyRound, Link2, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConnectionId, PublicProfile } from "@/lib/types";

interface ConnectionsPanelProps {
  profile: PublicProfile;
  onSaved: (profile: PublicProfile) => void;
  connectState: "connected" | "failed" | null;
  localMode: boolean;
}

const KEY_PROVIDERS: { id: Exclude<ConnectionId, "openrouter">; name: string; covers: string; placeholder: string; url: string }[] = [
  { id: "gateway", name: "Vercel AI Gateway", covers: "Alle Modelle über ein Konto", placeholder: "AI-Gateway-Key", url: "https://vercel.com/ai-gateway" },
  { id: "openai", name: "OpenAI", covers: "GPT-Modelle direkt", placeholder: "sk-…", url: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic", covers: "Claude-Modelle direkt", placeholder: "sk-ant-…", url: "https://console.anthropic.com/settings/keys" },
  { id: "google", name: "Google AI Studio", covers: "Gemini-Modelle direkt", placeholder: "AIza…", url: "https://aistudio.google.com/apikey" },
  { id: "xai", name: "xAI", covers: "Grok-Modelle direkt", placeholder: "xai-…", url: "https://console.x.ai" },
];

/** Eigene KI-Zugänge: OpenRouter mit einem Klick, weitere Anbieter per Key, lokal der Abo-Modus. */
export function ConnectionsPanel({ profile, onSaved, connectState, localMode }: ConnectionsPanelProps) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    connectState === "connected"
      ? { ok: true, text: "OpenRouter ist verbunden – deine Agenten laufen jetzt über dein Konto." }
      : connectState === "failed"
        ? { ok: false, text: "Die Verbindung mit OpenRouter hat nicht geklappt. Bitte versuche es erneut." }
        : null,
  );
  const hint = (id: ConnectionId) => profile.connections.find((c) => c.id === id)?.hint ?? null;
  const openrouter = hint("openrouter");

  async function save(provider: ConnectionId, key: string | null) {
    setStatus(null);
    const res = await fetch("/api/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    const data = (await res.json().catch(() => ({}))) as { profile?: PublicProfile; error?: string };
    if (!res.ok || !data.profile) {
      setStatus({ ok: false, text: data.error ?? "Speichern fehlgeschlagen" });
      return false;
    }
    onSaved(data.profile);
    setStatus({ ok: true, text: key ? "Zugang gespeichert (verschlüsselt)." : "Zugang entfernt." });
    return true;
  }

  return (
    <section className="mt-12" aria-labelledby="connections-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Deine KI-Zugänge</p>
          <h2 id="connections-title" className="mt-1 font-display text-[22px] font-semibold tracking-tight">
            Mit deinem eigenen Konto debattieren
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-2">
            Verbinde deinen Zugang – dann bezahlst du die KI-Antworten direkt beim Anbieter, ohne Token-Deckel in der App.
            Keys werden verschlüsselt gespeichert und nie wieder angezeigt.
          </p>
        </div>
      </div>

      {status && (
        <p role="status" className={clsx("mt-4 rounded-xl px-3 py-2 text-[13px]", status.ok ? "bg-signal/10 text-signal" : "bg-danger/10 text-danger")}>
          {status.text}
        </p>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.15fr_1fr]">
        <div className="glass-strong glow-card relative overflow-hidden rounded-3xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/30">
              <Link2 className="size-5 text-accent" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-semibold">OpenRouter</h3>
                <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent-strong">Empfohlen</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">
                Ein Konto für GPT, Claude, Gemini, Grok, Kimi, Llama, DeepSeek und hunderte weitere Modelle. Du lädst dort Guthaben
                auf und zahlst pro Antwort.
              </p>
            </div>
          </div>
          {openrouter ? (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-signal/30 bg-signal/[0.08] px-4 py-3">
              <span className="flex items-center gap-2 text-[13px]">
                <CheckCircle2 className="size-4 text-signal" />
                Verbunden <span className="font-mono text-[12px] text-ink-2">{openrouter}</span>
              </span>
              <button onClick={() => save("openrouter", null)} className="text-[12.5px] text-muted hover:text-danger">
                Trennen
              </button>
            </div>
          ) : (
            <a href="/api/connect/openrouter" className="btn-primary mt-5 flex w-full items-center justify-center gap-2 px-4 py-3 text-[14px]">
              <Link2 className="size-4" />
              Mit OpenRouter verbinden
            </a>
          )}
          <KeyForm
            label="Oder OpenRouter-Key einfügen"
            placeholder="sk-or-v1-…"
            onSave={(key) => save("openrouter", key)}
            compact
          />
        </div>

        <div className="glass rounded-3xl p-2">
          {KEY_PROVIDERS.map((p) => (
            <ProviderRow key={p.id} provider={p} hint={hint(p.id)} onSave={(key) => save(p.id, key)} />
          ))}
        </div>
      </div>

      {localMode && <LocalModeCard />}
    </section>
  );
}

function ProviderRow({
  provider,
  hint,
  onSave,
}: {
  provider: (typeof KEY_PROVIDERS)[number];
  hint: string | null;
  onSave: (key: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-3/40">
      <div className="flex items-center gap-3">
        <span className={clsx("flex size-8 items-center justify-center rounded-xl ring-1", hint ? "bg-signal/12 ring-signal/30" : "bg-surface-3/60 ring-line")}>
          {hint ? <CheckCircle2 className="size-4 text-signal" /> : <KeyRound className="size-4 text-muted" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">{provider.name}</div>
          <div className="truncate text-[12px] text-muted">{hint ? <span className="font-mono">{hint}</span> : provider.covers}</div>
        </div>
        {hint ? (
          <button onClick={() => onSave(null)} className="rounded-lg px-2 py-1 text-[12px] text-muted hover:text-danger">
            Entfernen
          </button>
        ) : (
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="btn-ghost px-3 py-1.5 text-[12px]">
            {open ? "Schließen" : "Key hinzufügen"}
          </button>
        )}
      </div>
      {open && !hint && (
        <div className="mt-2 pl-11">
          <KeyForm
            label={`${provider.name}-Key`}
            placeholder={provider.placeholder}
            onSave={async (key) => {
              const ok = await onSave(key);
              if (ok) setOpen(false);
              return ok;
            }}
          />
          <a href={provider.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-accent-strong hover:underline">
            Key beim Anbieter erstellen <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function KeyForm({ label, placeholder, onSave, compact }: { label: string; placeholder: string; onSave: (key: string) => Promise<boolean>; compact?: boolean }) {
  const [key, setKey] = useState("");
  return (
    <form
      className={clsx("flex gap-2", compact ? "mt-4" : "")}
      onSubmit={async (e) => {
        e.preventDefault();
        if (key.trim() && (await onSave(key.trim()))) setKey("");
      }}
    >
      <label className="sr-only" htmlFor={`key-${label}`}>
        {label}
      </label>
      <input
        id={`key-${label}`}
        type="password"
        autoComplete="off"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={compact ? `${label}: ${placeholder}` : placeholder}
        className="field min-w-0 flex-1 px-3 py-2 font-mono text-[12.5px]"
      />
      <button type="submit" disabled={!key.trim()} className="btn-ghost px-3 py-2 text-[12.5px]">
        Speichern
      </button>
    </form>
  );
}

interface CliStatus {
  id: string;
  label: string;
  command: string;
  found: boolean;
  install: string;
}

/** Nur lokal: zeigt, welche Abo-Programme gefunden wurden. */
function LocalModeCard() {
  const [programs, setPrograms] = useState<CliStatus[] | null>(null);
  useEffect(() => {
    fetch("/api/local/status")
      .then((r) => r.json())
      .then((d: { programs?: CliStatus[] }) => setPrograms(d.programs ?? []))
      .catch(() => setPrograms([]));
  }, []);

  return (
    <div className="glass mt-3 rounded-3xl p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-anthropic/15 ring-1 ring-anthropic/30">
          <Terminal className="size-5 text-anthropic" />
        </span>
        <div className="flex-1">
          <h3 className="text-[16px] font-semibold">Lokaler Abo-Modus ist an</h3>
          <p className="mt-1 text-[13px] text-ink-2">
            Agenten mit den Modellen „· eigenes Abo“ laufen über die Programme auf diesem Rechner – mit deinen Abos, ohne API-Key.
            Nur für dich persönlich: Die Anbieter sehen solche Nutzung nicht unbedingt vor.
          </p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {(programs ?? []).map((p) => (
          <li key={p.id} className="rounded-2xl border border-line/70 bg-canvas/30 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {p.found ? <CheckCircle2 className="size-4 text-signal" /> : <CircleDashed className="size-4 text-warn" />}
              {p.label}
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">{p.command}</div>
            {!p.found && <div className="mt-1 text-[11.5px] text-ink-2">Nicht gefunden – {p.install}</div>}
          </li>
        ))}
        {programs === null && <li className="text-[12.5px] text-muted">Prüfe installierte Programme …</li>}
      </ul>
    </div>
  );
}
