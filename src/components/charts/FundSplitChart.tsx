"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

export default function FundSplitChart({
  data,
}: {
  data: { month: string; burial: number; food: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#0f172a" fontSize={12} />
        <YAxis stroke="#0f172a" fontSize={12} />
        <Tooltip formatter={(value: number) => `R ${value.toFixed(2)}`} />
        <Legend />
        <Bar dataKey="burial" name="Burial fund" fill="#073b4c" radius={[3, 3, 0, 0]} />
        <Bar dataKey="food" name="Food fund" fill="#52b788" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
