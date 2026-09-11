import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { TRACE_RUNS } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { cn, formatRelative } from "@/lib/utils";

export const Route = createFileRoute("/_dash/traces")({ component: TracesPage });

function TracesPage() {
  const user = useAppStore((s) => s.user);
  const [runId, setRunId] = useState(TRACE_RUNS[0].id);
  if (user?.role !== "admin") return <Navigate to="/repos" />;
  const run = TRACE_RUNS.find((r) => r.id === runId) ?? TRACE_RUNS[0];
  const max = Math.max(...run.spans.map((s) => s.startedOffsetMs + s.latencyMs), 1);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold tracking-tight">Traces</h1>
      <p className="mt-1 text-sm text-muted">
        PRISM waterfall for evaluation, ask, and recommend runs. Local fallback if the collector is down.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TRACE_RUNS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRunId(r.id)}
            className={cn(
              "h-9 rounded-full border px-3 text-xs",
              r.id === run.id ? "border-accent text-accent" : "border-border text-muted",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <Card className="mt-5 overflow-x-auto p-4">
        <div className="mb-3 flex justify-between text-xs text-subtle">
          <span>{formatRelative(run.createdAt)}</span>
          <span className="tabular">{run.durationMs} ms</span>
        </div>
        <div className="min-w-[640px] space-y-2">
          {run.spans.map((s) => (
            <div key={s.id} className="grid grid-cols-[200px_1fr_88px] items-center gap-3 text-xs">
              <div>
                <div className="truncate font-mono text-fg">{s.name}</div>
                <div className="text-subtle">{s.model}</div>
              </div>
              <div className="relative h-7 rounded-sm bg-bg-subtle">
                <div
                  className={cn(
                    "absolute top-1 h-5 rounded-sm",
                    s.status === "ok" ? "bg-accent/70" : "bg-low/80",
                  )}
                  style={{
                    left: `${(s.startedOffsetMs / max) * 100}%`,
                    width: `${Math.max(1.5, (s.latencyMs / max) * 100)}%`,
                  }}
                />
              </div>
              <div className="text-right tabular text-muted">
                {s.latencyMs} ms
                {s.tokensIn ? (
                  <div className="text-[10px] text-subtle">
                    {s.tokensIn}/{s.tokensOut}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
