import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CRITERIA } from "@/lib/mock-data";
import type { CriterionId } from "@/lib/types";

type Series = { name: string; scores: Record<CriterionId, number>; color: string };

export function RadarScores({ series }: { series: Series[] }) {
  const data = CRITERIA.map((c) => {
    const row: Record<string, string | number> = { criterion: c.label };
    for (const s of series) row[s.name] = s.scores[c.id];
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="criterion"
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
          />
          {series.map((s) => (
            <Radar
              key={s.name}
              name={s.name}
              dataKey={s.name}
              stroke={s.color}
              fill={s.color}
              fillOpacity={series.length > 1 ? 0.12 : 0.2}
            />
          ))}
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-fg)",
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
