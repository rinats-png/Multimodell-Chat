import { MessagesSquare } from "lucide-react";
import { LegalLinks } from "@/components/legal/LegalLinks";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-openai via-google to-anthropic">
            <MessagesSquare className="size-5 text-white" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        </div>
        {children}
        <LegalLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
}

export const inputCls =
  "mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[14px] text-ink outline-none focus:border-accent/60";

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: { error?: string; code?: string; signedIn?: boolean } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; signedIn?: boolean };
  return { ok: res.ok, data };
}
