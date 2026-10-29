import clsx from "clsx";
import { agentStyle } from "@/lib/agent-style";

interface AgentAvatarProps {
  name: string;
  modelId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

export function AgentAvatar({ name, modelId, size = "md", className }: AgentAvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 select-none items-center justify-center rounded-lg font-semibold",
        agentStyle(modelId).avatar,
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function UserAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-surface-3 font-semibold text-ink-2 ring-1 ring-line-strong",
        SIZES[size],
      )}
      aria-hidden
    >
      DU
    </span>
  );
}
