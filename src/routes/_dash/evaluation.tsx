import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RadarScores } from "@/components/radar-scores";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CRITERIA } from "@/lib/mock-data";
import { developers, useAppStore, visibleRepos } from "@/lib/store";
import type { CriterionId } from "@/lib/types";
import { formatRelative, scoreTone } from "@/lib/utils";

type Search = { repo?: string };

export const Route = createFileRoute("/_dash/evaluation")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    repo: typeof s.repo === "string" ? s.repo : undefined,
  }),
  component: EvaluationPage,
});

function EvaluationPage() {
  const { repo: repoId } = Route.useSearch();
  const user = useAppStore((s) => s.user)!;
  const repos = visibleRepos(user, useAppStore((s) => s.repos));
  const weights = useAppStore((s) => s.weights);
  const repo = repos.find((r) => r.id === repoId) ?? repos.find((r) => r.scores) ?? repos[0];
  const [chart, setChart] = useState<"radar" | "bar">("radar");
  const [open, setOpen] = useState<CriterionId | null>("security");

  const weighted = useMemo(() => {
    if (!repo?.scores) return repo?.overall ?? null;
    return Number(
      CRITERIA.reduce((sum, c) => sum + (repo.scores?.[c.id] ?? 0) * weights[c.id], 0).toFixed(1),
    );
  }, [repo, weights]);

  if (!repo) {
    return <p className="text-sm text-muted">No visible repositories yet.</p>;
  }

  const contributors = developers.filter((d) => repo.contributorIds.includes(d.id));
  const barData = CRITERIA.map((c) => ({
    name: c.label,
    score: repo.scores?.[c.id] ?? 0,
  }));

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {repos
            .filter((r) => r.connected)
            .map((r) => (
              <Link
                key={r.id}
                to="/evaluation"
                search={{ repo: r.id }}
                className={`rounded-full border px-3 py-1 text-xs ${
                  r.id === repo.id
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:text-fg"
                }`}
              >
                {r.name}
              </Link>
            ))}
        </div>
        <div className="flex flex-wrap items-start gap-5">
          <ScoreRing score={weighted} size={96} stroke={8} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{repo.fullName}</h1>
            <p className="mt-1 text-sm text-muted">{repo.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtle">
              <span className="font-mono">{repo.headSha}</span>
              <span>{repo.defaultBranch}</span>
              {repo.lastEvaluatedAt ? (
                <span>Evaluated {formatRelative(repo.lastEvaluatedAt)}</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              className={`h-8 rounded-sm px-3 text-xs ${chart === "radar" ? "bg-bg-subtle" : "text-muted"}`}
              onClick={() => setChart("radar")}
            >
              Radar
            </button>
            <button
              className={`h-8 rounded-sm px-3 text-xs ${chart === "bar" ? "bg-bg-subtle" : "text-muted"}`}
              onClick={() => setChart("bar")}
            >
              Bars
            </button>
          </div>
        </div>

        <Card className="mt-5">
          {repo.scores ? (
            chart === "radar" ? (
              <RadarScores
                series={[
                  {
                    name: repo.name,
                    scores: repo.scores,
                    color: "var(--color-accent)",
                  },
                ]}
              />
            ) : (
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={barData} layout="vertical" margin={{ left: 16 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-bg-elevated)",
                        border: "1px solid var(--color-border)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="score" fill="var(--color-accent)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            <p className="text-sm text-muted">Connect and evaluate to see scores.</p>
          )}
        </Card>

        <div className="mt-5 space-y-2">
          {CRITERIA.map((c) => {
            const score = repo.scores?.[c.id];
            const ev = repo.evidence.find((e) => e.criterion === c.id);
            const isOpen = open === c.id;
            return (
              <div key={c.id} className="rounded-lg border border-border bg-bg-elevated">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setOpen(isOpen ? null : c.id)}
                >
                  <span className="w-36 text-sm font-medium">{c.label}</span>
                  <span className="hidden flex-1 text-xs text-subtle sm:block">{c.signals}</span>
                  <Badge tone={scoreTone(score)}>{score ?? "—"}</Badge>
                  <ChevronDown
                    className={`size-4 text-subtle transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen ? (
                  <div className="space-y-3 border-t border-border px-4 py-3">
                    <p className="text-sm text-muted">
                      {ev?.summary ?? "No additional findings stored for this criterion."}
                    </p>
                    {ev?.confidence != null ? (
                      <p className="text-[11px] text-subtle">
                        Confidence {(ev.confidence * 100).toFixed(0)}% · weight{" "}
                        {(weights[c.id] * 100).toFixed(0)}%
                      </p>
                    ) : null}
                    {ev?.findings.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-md border border-border bg-bg px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge tone={f.severity === "high" ? "low" : f.severity === "medium" ? "mid" : "muted"}>
                            {f.severity}
                          </Badge>
                          <span className="font-mono text-subtle">
                            {f.path}:{f.startLine}–{f.endLine}
                          </span>
                        </div>
                        <p className="mt-1 text-sm">{f.message}</p>
                        <p className="mt-1 text-xs text-muted">{f.suggestion}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="p-4">
          <h2 className="text-sm font-medium">Contributors</h2>
          <ul className="mt-3 space-y-2">
            {contributors.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <Link
                  to="/compare"
                  search={{ ids: d.id }}
                  className="hover:text-accent"
                >
                  {d.displayName}
                </Link>
                <span className="tabular text-xs text-muted">{d.overall}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-medium">Run history</h2>
          <ol className="mt-3 space-y-3 border-l border-border pl-3">
            <li className="text-xs">
              <div className="text-fg">Indexed {repo.headSha}</div>
              <div className="text-subtle">
                {repo.lastEvaluatedAt ? formatRelative(repo.lastEvaluatedAt) : "pending"}
              </div>
            </li>
            <li className="text-xs text-muted">
              <div>Previous SHA snapshot retained</div>
              <div className="text-subtle">history preserved</div>
            </li>
          </ol>
        </Card>
      </aside>
    </div>
  );
}
