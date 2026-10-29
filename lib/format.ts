const numberFmt = new Intl.NumberFormat("de-DE");

export function formatNumber(n: number): string {
  return numberFmt.format(Math.round(n));
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("de-DE")}k`;
  return formatNumber(n);
}

export function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
