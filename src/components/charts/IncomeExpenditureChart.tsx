"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export default function IncomeExpenditureChart({
  data,
}: {
  data: { month: string; income: number; expenditure: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#0f172a" fontSize={12} />
        <YAxis stroke="#0f172a" fontSize={12} />
        <Tooltip formatter={(value: number) => `R ${value.toFixed(2)}`} />
        <Legend />
        <Bar dataKey="income" name="Income" fill="#52b788" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenditure" name="Expenditure" fill="#d97706" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
