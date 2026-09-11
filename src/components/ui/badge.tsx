import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  children,
}: {
  className?: string;
  tone?: "muted" | "accent" | "high" | "mid" | "low" | "admin" | "employer";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    muted: "bg-bg-subtle text-muted border-border",
    accent: "bg-accent/15 text-accent border-accent/30",
    high: "bg-high/15 text-high border-high/30",
    mid: "bg-mid/15 text-mid border-mid/30",
    low: "bg-low/15 text-low border-low/30",
    admin: "bg-accent/15 text-accent border-accent/30",
    employer: "bg-bg-subtle text-muted border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
