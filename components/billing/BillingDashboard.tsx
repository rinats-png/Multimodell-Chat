"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCompact, formatNumber, formatUsd } from "@/lib/format";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import type { PublicProfile, SubscriptionTier } from "@/lib/types";
import { AccountSection } from "@/components/account/AccountSection";
import { Meter } from "@/components/ui/Meter";
import { ConnectionsPanel } from "./ConnectionsPanel";

interface BillingDashboardProps {
  profile: PublicProfile;
  totals: { input: number; output: number; cost: number; replies: number };
  isDemoStore: boolean;
  billingConfigured: boolean;
  checkoutState: "success" | "cancelled" | null;
  connectState: "connected" | "failed" | null;
  localMode: boolean;
}

export function BillingDashboard({ profile: initialProfile, totals, isDemoStore, billingConfigured, checkoutState, connectState, localMode }: BillingDashboardProps) {
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-10">
      <h1 className="font-display text-[26px] font-medium tracking-tight">Tarif & Verbrauch</h1>
      {checkoutState === "success" && (
        <p role="status" className="mt-3 rounded-lg border border-openai/30 bg-openai/10 px-3 py-2 text-[13px] text-openai">
          Danke! Die Zahlung wird bestätigt – dein Tarif wird in wenigen Sekunden freigeschaltet. Lade die Seite gleich neu.
        </p>
      )}
      {checkoutState === "cancelled" && (
        <p role="status" className="glass mt-3 rounded-xl px-3 py-2 text-[13px] text-muted">
          Der Bezahlvorgang wurde abgebrochen. Es wurde nichts berechnet.
        </p>
      )}
      <p className="mt-1 text-[14px] text-muted">
        Abrechnungszeitraum seit {new Date(profile.usage_period_start).toLocaleDateString("de-DE")} · Reset am Monatsanfang
      </p>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <div className="glass relative overflow-hidden rounded-2xl p-5 md:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/20 blur-3xl" aria-hidden />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-muted">Tokens diesen Monat</span>
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-strong">{plan.name}</span>
          </div>
          {profile.has_custom_key ? (
            <>
              <div className="mt-2 text-2xl font-semibold">{formatNumber(profile.tokens_used_this_month)}</div>
              <p className="mt-1 text-[12px] text-muted">Eigener Zugang aktiv – kein Token-Deckel.</p>
            </>
          ) : (
            <>
              <div className="mt-2 font-display text-3xl font-medium tabular-nums">
                {formatNumber(profile.tokens_used_this_month)}
                <span className="text-[15px] font-normal text-muted"> / {formatCompact(profile.monthly_token_limit)}</span>
              </div>
              <Meter value={profile.tokens_used_this_month} max={profile.monthly_token_limit} className="mt-3" />
              <p className="mt-2 text-[12px] text-muted">{formatNumber(remaining)} Tokens verbleibend</p>
            </>
          )}
        </div>
        <Stat label="Rate-Limit" value={`${profile.rate_limit_per_min}/Min`} hint="KI-Antworten pro Minute (gleitendes Fenster)" />
        <Stat label="Geschätzte API-Kosten" value={formatUsd(totals.cost)} hint={`${formatNumber(totals.replies)} KI-Antworten`} />
      </section>

      <section className="mt-3 grid gap-3 md:grid-cols-2">
        <Stat label="Input-Tokens (Ledger)" value={formatNumber(totals.input)} hint="Kontext inkl. Sliding Window" />
        <Stat label="Output-Tokens (Ledger)" value={formatNumber(totals.output)} hint="Generierte Antworten" />
      </section>

      <ConnectionsPanel profile={profile} onSaved={setProfile} connectState={connectState} localMode={localMode} />

      <section className="mt-12">
        <h2 className="text-center font-display text-[28px] font-medium tracking-tight sm:text-[34px]">
          <span className="text-gradient">Mehr Stimmen, mehr Perspektiven.</span>
        </h2>
        <p className="mt-2 text-center text-[14px] text-ink-2">Wähle den Tarif, der zu deinen Debatten passt.</p>
        {error && <p className="mt-4 text-center text-[13px] text-danger">{error}</p>}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const p = PLANS[tier];
            const current = tier === profile.subscription_tier;
            const highlighted = tier === "pro";
            return (
              <div
                key={tier}
                className={clsx(
                  "relative flex flex-col overflow-hidden rounded-2xl p-5",
                  highlighted ? "glass-strong ring-1 ring-accent/50 shadow-[0_0_60px_-20px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]" : "glass",
                )}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-[16px] font-semibold">{p.name}</h3>
                  {highlighted && (
                    <span className="rounded-full bg-gradient-to-r from-accent to-openai px-2.5 py-0.5 text-[11px] font-semibold text-on-accent">Beliebt</span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-medium tracking-tight">{p.priceEur} €</span>
                  <span className="text-[13px] text-muted">/ Monat</span>
                </div>
                <p className="mt-2 border-b border-line/70 pb-4 text-[13px] text-muted">{p.tagline}</p>
                <button
                  onClick={() => choosePlan(tier)}
                  disabled={current || busyTier !== null}
                  className={clsx(
                    "mt-4 px-3 py-2.5 text-[13px] font-semibold",
                    current
                      ? "cursor-default rounded-xl border border-line/80 text-muted"
                      : highlighted
                        ? "btn-primary"
                        : "btn-ghost",
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

      <AccountSection isDemoStore={isDemoStore} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-2 font-display text-2xl font-medium tabular-nums">{value}</div>
      <p className="mt-1 text-[12px] text-muted">{hint}</p>
    </div>
  );
}
