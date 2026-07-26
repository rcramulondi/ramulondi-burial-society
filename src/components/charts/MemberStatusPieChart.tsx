"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { STATUS_CHART_COLORS } from "@/lib/chartColors";

// Matches MEMBER_STATUS_COLORS in statusColors.ts so slices agree with the
// status badges shown everywhere else in the app.
const COLORS: Record<string, string> = {
  ACTIVE: STATUS_CHART_COLORS.green,
  ABOUT_TO_LAPSE: STATUS_CHART_COLORS.amber,
  IN_ACTIVE: STATUS_CHART_COLORS.red,
  DECEASED: STATUS_CHART_COLORS.grey,
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
