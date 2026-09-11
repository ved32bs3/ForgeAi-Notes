import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CRITERIA, ROLE_MATRIX } from "@/lib/mock-data";
import { developers } from "@/lib/store";
import type { CriterionId, Developer } from "@/lib/types";

export const Route = createFileRoute("/_dash/recommend")({
  component: RecommendPage,
});

function fit(dev: Developer, role: string) {
  const matrix = ROLE_MATRIX[role];
  let num = 0;
  let den = 0;
  for (const [k, w] of Object.entries(matrix)) {
    num += (dev.scores[k as CriterionId] ?? 0) * (w ?? 0);
    den += w ?? 0;
  }
  return den ? num / den : 0;
}

function complementaryTeam(size = 4) {
  const axes = CRITERIA.map((c) => c.id);
  const picked: Developer[] = [];
  const pool = [...developers];
  while (picked.length < size && pool.length) {
    let best = pool[0];
    let bestScore = -1;
    for (const cand of pool) {
      const coverage = axes.reduce((sum, axis) => {
        const have = Math.max(0, ...picked.map((p) => p.scores[axis]), 0);
        const gain = Math.max(0, cand.scores[axis] - have);
        return sum + gain;
      }, 0);
      if (coverage > bestScore) {
        bestScore = coverage;
        best = cand;
      }
    }
    picked.push(best);
    pool.splice(pool.indexOf(best), 1);
  }
  return picked;
}

function RecommendPage() {
  const [tab, setTab] = useState<"roles" | "team">("roles");
  const [devId, setDevId] = useState(developers[0].id);
  const dev = developers.find((d) => d.id === devId)!;
  const roles = useMemo(
    () =>
      Object.keys(ROLE_MATRIX)
        .map((role) => ({ role, score: fit(dev, role) }))
        .sort((a, b) => b.score - a.score),
    [dev],
  );
  const team = useMemo(() => complementaryTeam(4), []);
  const coverage = CRITERIA.map((c) => ({
    label: c.label,
    value: Math.max(...team.map((t) => t.scores[c.id])),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold tracking-tight">Recommend</h1>
      <p className="mt-1 text-sm text-muted">
        Fits are weighted averages of criterion scores. The model only writes the rationale.
      </p>
      <div className="mt-4 flex gap-1">
        <button
          className={`h-9 rounded-sm px-4 text-sm ${tab === "roles" ? "bg-bg-subtle" : "text-muted"}`}
          onClick={() => setTab("roles")}
        >
          Role fit
        </button>
        <button
          className={`h-9 rounded-sm px-4 text-sm ${tab === "team" ? "bg-bg-subtle" : "text-muted"}`}
          onClick={() => setTab("team")}
        >
          Hackathon team
        </button>
      </div>

      {tab === "roles" ? (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {developers.map((d) => (
              <button
                key={d.id}
                onClick={() => setDevId(d.id)}
                className={`h-9 rounded-full border px-3 text-xs ${
                  d.id === devId ? "border-accent text-accent" : "border-border text-muted"
                }`}
              >
                {d.displayName}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {roles.map((r, i) => (
              <Card key={r.role} className="flex flex-wrap items-center gap-4 p-4">
                <ScoreRing score={r.score} size={56} stroke={5} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium">{r.role}</h2>
                    {i === 0 ? <Badge tone="accent">Best fit</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {dev.displayName} scores highest on{" "}
                    {Object.entries(ROLE_MATRIX[r.role])
                      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                      .slice(0, 2)
                      .map(([k]) => CRITERIA.find((c) => c.id === k)?.label)
                      .join(" and ")}
                    , which this role weights most heavily.
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {team.map((d) => (
              <Card key={d.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{d.displayName}</div>
                    <div className="text-xs text-subtle">{d.title}</div>
                  </div>
                  <ScoreRing score={d.overall} size={48} stroke={4} />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Strongest:{" "}
                  {CRITERIA.slice()
                    .sort((a, b) => d.scores[b.id] - d.scores[a.id])
                    .slice(0, 2)
                    .map((c) => c.label)
                    .join(", ")}
                </p>
              </Card>
            ))}
          </div>
          <Card className="p-4">
            <h2 className="text-sm font-medium">Coverage</h2>
            <p className="mt-1 text-xs text-muted">
              Max score on each axis across the four people. Avoids an all-innovation team.
            </p>
            <ul className="mt-3 space-y-2">
              {coverage.map((c) => (
                <li key={c.label}>
                  <div className="mb-1 flex justify-between text-[11px] text-subtle">
                    <span>{c.label}</span>
                    <span className="tabular">{c.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${c.value}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
