import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RadarScores } from "@/components/radar-scores";
import { Card } from "@/components/ui/card";
import { CRITERIA } from "@/lib/mock-data";
import { developers } from "@/lib/store";
import { cn, scoreTone } from "@/lib/utils";

type Search = { ids?: string };

export const Route = createFileRoute("/_dash/compare")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ids: typeof s.ids === "string" ? s.ids : undefined,
  }),
  component: ComparePage,
});

const COLORS = [
  "var(--color-accent)",
  "var(--color-high)",
  "var(--color-mid)",
  "var(--color-fg)",
];

function ComparePage() {
  const { ids } = Route.useSearch();
  const initial = ids?.split(",").filter(Boolean) ?? ["dev-alex", "dev-priya"];
  const [selected, setSelected] = useState<string[]>(initial.slice(0, 4));

  function toggle(id: string) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) return cur;
      return [...cur, id];
    });
  }

  const chosen = developers.filter((d) => selected.includes(d.id));
  const series = chosen.map((d, i) => ({
    name: d.displayName,
    scores: d.scores,
    color: COLORS[i % COLORS.length],
  }));

  const extremes = useMemo(() => {
    if (chosen.length < 2) return null;
    return CRITERIA.map((c) => {
      const vals = chosen.map((d) => ({ name: d.displayName, v: d.scores[c.id] }));
      const max = vals.reduce((a, b) => (a.v > b.v ? a : b));
      const min = vals.reduce((a, b) => (a.v < b.v ? a : b));
      return { criterion: c.label, strongest: max, weakest: min };
    });
  }, [chosen]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-semibold tracking-tight">Compare</h1>
      <p className="mt-1 text-sm text-muted">
        Overlay up to four developers. Ranking is numeric — the chart does not invent gaps.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {developers.map((d) => {
          const on = selected.includes(d.id);
          return (
            <button
              key={d.id}
              onClick={() => toggle(d.id)}
              className={cn(
                "h-9 rounded-full border px-3 text-xs",
                on ? "border-accent text-accent" : "border-border text-muted",
              )}
            >
              {d.displayName}
              <span className="ml-2 tabular text-subtle">{d.overall}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          {series.length ? (
            <RadarScores series={series} />
          ) : (
            <p className="text-sm text-muted">Select at least one developer.</p>
          )}
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Criterion</th>
                {chosen.map((d) => (
                  <th key={d.id} className="px-3 py-3 font-medium">
                    {d.initials}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c.id} className="border-b border-border/70">
                  <td className="px-4 py-2 text-muted">{c.label}</td>
                  {chosen.map((d) => {
                    const v = d.scores[c.id];
                    const tone = scoreTone(v);
                    return (
                      <td
                        key={d.id}
                        className={cn(
                          "px-3 py-2 tabular",
                          tone === "high" && "text-high",
                          tone === "mid" && "text-mid",
                          tone === "low" && "text-low",
                        )}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 font-medium">Overall</td>
                {chosen.map((d) => (
                  <td key={d.id} className="px-3 py-3 font-medium tabular">
                    {d.overall}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      {extremes ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {extremes.map((e) => (
            <div
              key={e.criterion}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
            >
              <span className="text-muted">{e.criterion}</span>
              <span>
                <span className="text-high">{e.strongest.name}</span>
                <span className="text-subtle"> · </span>
                <span className="text-low">{e.weakest.name}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
