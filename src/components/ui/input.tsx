import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-sm border border-border bg-bg-elevated px-3 text-sm text-fg placeholder:text-subtle outline-none focus-visible:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}
