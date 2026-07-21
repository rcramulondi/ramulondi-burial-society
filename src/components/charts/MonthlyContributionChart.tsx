"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export default function MonthlyContributionChart({
  data,
}: {
  data: { month: string; actual: number; projected: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#0f172a" fontSize={12} />
        <YAxis stroke="#0f172a" fontSize={12} />
        <Tooltip formatter={(value: number) => `R ${value.toFixed(2)}`} />
        <Legend />
        <Bar dataKey="actual" name="Actual" fill="#0f172a" radius={[3, 3, 0, 0]} />
        <Bar dataKey="projected" name="Projected" fill="#d97706" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
