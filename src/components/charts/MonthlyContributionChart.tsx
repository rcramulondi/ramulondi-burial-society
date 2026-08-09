"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatCurrency } from "@/lib/format";

export default function MonthlyContributionChart({
  data,
}: {
  data: { month: string; actual: number; projected: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="month" stroke={CHART_COLORS.axis} fontSize={12} />
        <YAxis stroke={CHART_COLORS.axis} fontSize={12} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Bar dataKey="actual" name="Actual" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
        <Bar dataKey="projected" name="Projected" fill={CHART_COLORS.sky} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
