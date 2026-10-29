"use client";

import clsx from "clsx";
import { Check, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCompact, formatNumber, formatUsd } from "@/lib/format";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import type { PublicProfile, SubscriptionTier } from "@/lib/types";
import { AccountSection } from "@/components/account/AccountSection";
import { Meter } from "@/components/ui/Meter";

interface BillingDashboardProps {
  profile: PublicProfile;
  totals: { input: number; output: number; cost: number; replies: number };
  isDemoStore: boolean;
  billingConfigured: boolean;
  checkoutState: "success" | "cancelled" | null;
}

export function BillingDashboard({ profile: initialProfile, totals, isDemoStore, billingConfigured, checkoutState }: BillingDashboardProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [busyTier, setBusyTier] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plan = PLANS[profile.subscription_tier];
  const remaining = Math.max(0, profile.monthly_token_limit - profile.tokens_used_this_month);

  async function openPortal() {
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) return setError(data.error ?? "Abo-Verwaltung nicht verfügbar");
    window.location.href = data.url;
  }

  async function choosePlan(tier: SubscriptionTier) {
    if (!isDemoStore && tier === "free") return openPortal();
    setBusyTier(tier);
    setError(null);
    try {
      const res = await fetch("/api/billing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { profile?: PublicProfile; checkoutUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Tarifwechsel fehlgeschlagen");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.profile) setProfile(data.profile);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tarifwechsel fehlgeschlagen");
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Tarif & Verbrauch</h1>
      {checkoutState === "success" && (
        <p role="status" className="mt-3 rounded-lg border border-openai/30 bg-openai/10 px-3 py-2 text-[13px] text-openai">
          Danke! Die Zahlung wird bestätigt – dein Tarif wird in wenigen Sekunden freigeschaltet. Lade die Seite gleich neu.
        </p>
      )}
      {checkoutState === "cancelled" && (
        <p role="status" className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted">
          Der Bezahlvorgang wurde abgebrochen. Es wurde nichts berechnet.
        </p>
      )}
      <p className="mt-1 text-[14px] text-muted">
        Abrechnungszeitraum seit {new Date(profile.usage_period_start).toLocaleDateString("de-DE")} · Reset am Monatsanfang
      </p>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-4 md:col-span-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted">Tokens diesen Monat</span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2">{plan.name}</span>
          </div>
          {profile.has_custom_key ? (
            <>
              <div className="mt-2 text-2xl font-semibold">{formatNumber(profile.tokens_used_this_month)}</div>
              <p className="mt-1 text-[12px] text-muted">Eigener OpenRouter-Key aktiv – kein Token-Deckel.</p>
            </>
          ) : (
            <>
              <div className="mt-2 text-2xl font-semibold">
                {formatNumber(profile.tokens_used_this_month)}
                <span className="text-[15px] font-normal text-muted"> / {formatCompact(profile.monthly_token_limit)}</span>
              </div>
              <Meter value={profile.tokens_used_this_month} max={profile.monthly_token_limit} className="mt-3" />
              <p className="mt-2 text-[12px] text-muted">{formatNumber(remaining)} Tokens verbleibend</p>
            </>
          )}
        </div>
        <Stat label="Rate-Limit" value={`${profile.rate_limit_per_min}/Min`} hint="Sliding Window über 60 s" />
        <Stat label="Geschätzte API-Kosten" value={formatUsd(totals.cost)} hint={`${formatNumber(totals.replies)} KI-Antworten`} />
      </section>

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        <Stat label="Input-Tokens (Ledger)" value={formatNumber(totals.input)} hint="Kontext inkl. Sliding Window" />
        <Stat label="Output-Tokens (Ledger)" value={formatNumber(totals.output)} hint="Generierte Antworten" />
      </section>

      <section className="mt-12">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Mehr Stimmen, mehr Perspektiven.</h2>
        <p className="mt-2 text-center text-[14px] text-muted">Wähle den Tarif, der zu deinen Debatten passt.</p>
        {error && <p className="mt-4 text-center text-[13px] text-red-400">{error}</p>}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const p = PLANS[tier];
            const current = tier === profile.subscription_tier;
            const highlighted = tier === "pro";
            return (
              <div
                key={tier}
                className={clsx(
                  "flex flex-col rounded-2xl border p-5",
                  highlighted ? "border-accent/60 bg-gradient-to-b from-accent/10 to-surface" : "border-line bg-surface",
                )}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-[16px] font-semibold">{p.name}</h3>
                  {highlighted && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Beliebt</span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{p.priceEur} €</span>
                  <span className="text-[13px] text-muted">/ Monat</span>
                </div>
                <p className="mt-2 border-b border-line pb-4 text-[13px] text-muted">{p.tagline}</p>
                <button
                  onClick={() => choosePlan(tier)}
                  disabled={current || busyTier !== null}
                  className={clsx(
                    "mt-4 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                    current
                      ? "cursor-default border border-line text-muted"
                      : highlighted
                        ? "bg-accent text-white hover:bg-accent-strong"
                        : "bg-ink text-canvas hover:bg-ink-2",
                  )}
                >
                  {current ? "Aktueller Tarif" : busyTier === tier ? "Wird geöffnet…" : `${p.name} wählen`}
                </button>
                <ul className="mt-5 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[13px] text-ink-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent-strong" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {isDemoStore ? (
          <p className="mt-3 text-center text-[12px] text-muted">
            Demo-Workspace: Tarifwechsel werden lokal sofort ohne Zahlung übernommen.
          </p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-1 text-[12px] text-muted">
            {!billingConfigured && <p>Die Bezahlung ist noch nicht eingerichtet.</p>}
            {billingConfigured && profile.subscription_tier !== "free" && (
              <button onClick={openPortal} className="text-accent-strong hover:underline">
                Abo verwalten oder kündigen
              </button>
            )}
            <p>Preise inkl. gesetzlicher MwSt. Monatlich kündbar.</p>
          </div>
        )}
      </section>

      <ByokForm profile={profile} onSaved={setProfile} />
      <AccountSection isDemoStore={isDemoStore} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-[12px] text-muted">{hint}</p>
    </div>
  );
}

function ByokForm({ profile, onSaved }: { profile: PublicProfile; onSaved: (p: PublicProfile) => void }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const enabled = profile.subscription_tier === "team";

  async function save(value: string | null) {
    setStatus(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_openrouter_key: value }),
    });
    const data = (await res.json()) as { profile?: PublicProfile; error?: string };
    if (!res.ok || !data.profile) return setStatus({ ok: false, text: data.error ?? "Speichern fehlgeschlagen" });
    onSaved(data.profile);
    setKey("");
    setStatus({ ok: true, text: value ? "Key gespeichert – alle Agenten laufen jetzt über deinen Account." : "Key entfernt." });
  }

  return (
    <section className="mt-12 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-surface-3">
          <KeyRound className="size-4 text-ink-2" />
        </div>
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">Bring Your Own Key</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Hinterlege deinen eigenen OpenRouter-Key. Alle Modell-Aufrufe laufen dann über deinen Account – ohne Token-Deckel.
            {!enabled && " Verfügbar im Workspace/BYOK-Tarif."}
          </p>
        </div>
      </div>
      {profile.has_custom_key && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3 py-2">
          <span className="font-mono text-[12.5px] text-ink-2">{profile.custom_key_hint}</span>
          <button onClick={() => save(null)} className="text-[12px] text-muted hover:text-red-400">
            Entfernen
          </button>
        </div>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) save(key.trim());
        }}
      >
        <input
          type="password"
          autoComplete="off"
          disabled={!enabled}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-or-v1-…"
          className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[13px] outline-none focus:border-accent/60 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!enabled || !key.trim()}
          className="rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-canvas disabled:bg-surface-3 disabled:text-muted"
        >
          Speichern
        </button>
      </form>
      {status && <p className={clsx("mt-2 text-[12.5px]", status.ok ? "text-openai" : "text-red-400")}>{status.text}</p>}
    </section>
  );
}
