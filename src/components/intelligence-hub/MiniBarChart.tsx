"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";

/**
 * The "charts" layer — a small cost-breakdown bar chart, not a BI-grade
 * chart library treatment. No axes, no gridlines, no legend: 4-6 data
 * points read faster as plain labeled bars than as a full chart-with-
 * chrome. Uses the brand gradient via an inline SVG <defs> gradient
 * (recharts renders whatever fill you give a <Cell>).
 */
export function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="df-bar-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--df-cyan)" />
              <stop offset="100%" stopColor="var(--df-teal)" />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ fill: "var(--df-border-soft, #edf2f7)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--df-border)",
              fontSize: 12,
              fontFamily: "var(--font-inter), Inter, sans-serif",
            }}
            formatter={(v) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill="url(#df-bar-gradient)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
