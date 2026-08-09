"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatCurrency } from "@/lib/format";

export default function IncomeExpenditureChart({
  data,
}: {
  data: { month: string; income: number; expenditure: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="month" stroke={CHART_COLORS.axis} fontSize={12} />
        <YAxis stroke={CHART_COLORS.axis} fontSize={12} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Bar dataKey="income" name="Income" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenditure" name="Expenditure" fill={CHART_COLORS.navy} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
