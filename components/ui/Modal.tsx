"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, subtitle, children, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fokus in den Dialog setzen, darin halten und beim Schließen zurückgeben (Barrierefreiheit).
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`glass-strong flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl ${wide ? "max-w-4xl" : "max-w-lg"}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-3/60 hover:text-ink" aria-label="Schließen">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
