"use client";

import { Check, Copy, FileDown, Link2, Link2Off, Printer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReportActionsProps {
  reportId: string;
  shared: boolean;
  /** Bericht als Markdown (Format von ENTSCHEIDUNGEN.md aus idea-to-app). */
  markdown?: string;
  fileName?: string;
}

/** Aktionen des Besitzers: Link teilen und widerrufen, drucken (PDF), löschen. Der Link steht nur direkt nach dem Erzeugen zur Verfügung. */
export function ReportActions({ reportId, shared: initiallyShared, markdown, fileName = "bericht.md" }: ReportActionsProps) {
  const router = useRouter();
  const [shared, setShared] = useState(initiallyShared);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, init: RequestInit): Promise<Response | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, init);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Das hat nicht geklappt. Bitte versuche es erneut.");
        return null;
      }
      return res;
    } catch {
      setError("Keine Verbindung. Bitte prüfe dein Netz und versuche es erneut.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function share(enabled: boolean) {
    const res = await call(`/api/reports/${reportId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    if (!res) return;
    const data = (await res.json()) as { shared: boolean; url?: string };
    setShared(data.shared);
    setUrl(data.url ?? null);
    setCopied(false);
    if (data.url) void copy(data.url);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadMarkdown() {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(href);
  }

  async function remove() {
    if (!confirm("Diesen Bericht samt Freigabe-Link löschen?")) return;
    const res = await call(`/api/reports/${reportId}`, { method: "DELETE" });
    if (res) router.push("/reports");
  }

  const btn = "btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50";
  return (
    <div className="no-print mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => share(true)} disabled={busy}>
          <Link2 className="size-4" aria-hidden />
          {shared ? "Neuen Link erstellen" : "Link zum Teilen erstellen"}
        </button>
        {shared && (
          <button className={btn} onClick={() => share(false)} disabled={busy}>
            <Link2Off className="size-4" aria-hidden />
            Link widerrufen
          </button>
        )}
        <button className={btn} onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Drucken / als PDF speichern
        </button>
        {markdown && (
          <button className={btn} onClick={downloadMarkdown} title="Markdown-Datei mit fertigem Eintrag für ENTSCHEIDUNGEN.md (idea-to-app) und dem ganzen Bericht">
            <FileDown className="size-4" aria-hidden />
            Als Markdown
          </button>
        )}
        <button className={`${btn} ml-auto text-danger`} onClick={remove} disabled={busy}>
          <Trash2 className="size-4" aria-hidden />
          Löschen
        </button>
      </div>
      {url && (
        <div role="status" className="mt-3 rounded-xl border border-signal/30 bg-signal/10 px-3 py-2.5 text-[13px]">
          <p className="font-medium text-signal">{copied ? "Link kopiert." : "Dein Link:"} Jeder mit diesem Link kann den Bericht lesen, aber nicht deine Debatte.</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input readOnly value={url} aria-label="Freigabe-Link" onFocus={(e) => e.currentTarget.select()} className="field min-w-0 flex-1 px-2.5 py-1.5 text-[12.5px]" />
            <button className={btn} onClick={() => copy(url)}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              Kopieren
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-muted">Der Link wird nur jetzt angezeigt. Ein neuer Link macht den alten ungültig.</p>
        </div>
      )}
      {shared && !url && <p className="mt-3 text-[12.5px] text-muted">Dieser Bericht ist per Link freigegeben. Aus Sicherheitsgründen kann der Link nicht erneut angezeigt werden: erstelle einen neuen oder widerrufe ihn.</p>}
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
