"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chartColors";

const COLORS: Record<string, string> = {
  "Burial payouts": CHART_COLORS.primary,
  "Other expenses": CHART_COLORS.sky,
};

export default function ExpenditureSplitPieChart({
  data,
}: {
  data: { label: string; amount: number }[];
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ label, value }) => `${label} ${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%`}
        >
          {data.map((entry) => (
            <Cell key={entry.label} fill={COLORS[entry.label] ?? "#cbd5e1"} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number, name: string) => [`R ${value.toFixed(2)}`, name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
