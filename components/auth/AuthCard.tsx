import { LegalLinks } from "@/components/legal/LegalLinks";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="frame relative w-full max-w-md overflow-hidden rounded-[10px] px-6 py-8 sm:px-8">
        <div className="glow-field" aria-hidden />
        <div className="relative flex flex-col items-center text-center">
          <BrandMark className="size-12" />
          <Wordmark className="mt-3 text-[13px] font-medium uppercase tracking-[0.2em] text-ink-2" />
          <h1 className="mt-5 font-display text-[24px] font-medium tracking-tight">{title}</h1>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
        </div>
        <div className="relative">{children}</div>
        <LegalLinks className="relative mt-6 justify-center" />
      </div>
    </main>
  );
}

export const inputCls = "field mt-1 px-3 py-2.5 text-[14px]";

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: { error?: string; code?: string; signedIn?: boolean } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; signedIn?: boolean };
  return { ok: res.ok, data };
}
