import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  name: string;
  date: string;
  taux: number;
}

/** Graphique en ligne simple : taux de présence par session, chronologique. */
export function PresenceChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickFormatter={(value: string) => (value.length > 14 ? `${value.slice(0, 13)}…` : value)}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(value) => [`${value} %`, "Taux de présence"]}
          />
          <Line
            type="monotone"
            dataKey="taux"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--primary)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini-graphique des dernières sessions (fiche participant). */
export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="text-xs text-muted-foreground">-</span>;
  const width = 96;
  const height = 28;
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - (p / 100) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} role="img" aria-label="Évolution du taux de présence">
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.75" />
    </svg>
  );
}