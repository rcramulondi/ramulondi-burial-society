"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";

const COLORS: Record<string, string> = {
  ACTIVE: "#0f172a",
  ABOUT_TO_LAPSE: "#d97706",
  IN_ACTIVE: "#94a3b8",
  DECEASED: "#475569",
};

export default function MemberStatusPieChart({
  data,
}: {
  data: { status: string; label: string; count: number; percent: number }[];
}) {
  const router = useRouter();

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ label, percent }) => `${label} ${percent}%`}
          onClick={(entry) => router.push(`/admin/members?status=${entry.status}`)}
          cursor="pointer"
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={COLORS[entry.status] ?? "#cbd5e1"} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number, _name, entry) => [`${value} (${entry.payload.percent}%)`, entry.payload.label]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
