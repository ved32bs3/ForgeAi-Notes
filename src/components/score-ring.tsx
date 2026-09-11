import { scoreTone } from "@/lib/utils";

export function ScoreRing({
  score,
  size = 72,
  stroke = 6,
}: {
  score: number | null;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const tone = scoreTone(score);
  const color =
    tone === "high"
      ? "var(--color-high)"
      : tone === "mid"
        ? "var(--color-mid)"
        : tone === "low"
          ? "var(--color-low)"
          : "var(--color-subtle)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.min(100, v) / 100) * c}
        />
      </svg>
      <span className="absolute tabular text-sm font-medium text-fg">
        {score == null ? "—" : Math.round(score)}
      </span>
    </div>
  );
}
