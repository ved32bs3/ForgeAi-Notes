import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CRITERIA } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import type { CriterionId } from "@/lib/types";

export const Route = createFileRoute("/_dash/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAppStore((s) => s.user);
  const weights = useAppStore((s) => s.weights);
  const setWeights = useAppStore((s) => s.setWeights);
  const resetWeights = useAppStore((s) => s.resetWeights);
  const repos = useAppStore((s) => s.repos);
  const toggleVisibility = useAppStore((s) => s.toggleVisibility);
  if (user?.role !== "admin") return <Navigate to="/repos" />;

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);

  function onChange(id: CriterionId, raw: number) {
    const next = { ...weights, [id]: raw / 100 };
    const total = Object.values(next).reduce((a, b) => a + b, 0);
    if (total <= 0) return;
    const normalized = Object.fromEntries(
      Object.entries(next).map(([k, v]) => [k, v / total]),
    ) as typeof weights;
    setWeights(normalized);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Scoring profile</h1>
        <p className="mt-1 text-sm text-muted">
          Weights always renormalize to 1.00. Overall = Σ w<sub>c</sub> · score<sub>c</sub>.
        </p>
        <Card className="mt-4 space-y-4 p-4">
          {CRITERIA.map((c) => (
            <label key={c.id} className="block">
              <div className="mb-1 flex justify-between text-xs">
                <span>{c.label}</span>
                <span className="tabular text-muted">{(weights[c.id] * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={40}
                value={Math.round(weights[c.id] * 100)}
                onChange={(e) => onChange(c.id, Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </label>
          ))}
          <div className="flex items-center justify-between text-xs text-subtle">
            <span className="tabular">Sum {(sum * 100).toFixed(1)}%</span>
            <Button variant="ghost" size="sm" onClick={resetWeights}>
              Reset default
            </Button>
          </div>
        </Card>
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Employer visibility</h2>
        <p className="mt-1 text-sm text-muted">
          Employers only see connected repos marked visible. They cannot widen this.
        </p>
        <Card className="mt-4 divide-y divide-border p-0">
          {repos.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm">{r.fullName}</div>
                <div className="text-[11px] text-subtle">
                  {r.connected ? "connected" : "not connected"}
                </div>
              </div>
              <button
                disabled={!r.connected}
                onClick={() => toggleVisibility(r.id)}
                className="h-9 rounded-sm border border-border px-3 text-xs disabled:opacity-40"
              >
                {r.visibleToEmployers ? "Visible" : "Hidden"}
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
