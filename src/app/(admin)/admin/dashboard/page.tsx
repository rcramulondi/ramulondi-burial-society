import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/statusLabels";
import type { MemberStatus } from "@prisma/client";

export default async function AdminDashboardPage() {
  const [statusCounts, pendingClaims, fundTotals] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: true }),
    prisma.claim.count({ where: { status: "PENDING" } }),
    prisma.paymentAllocation.groupBy({ by: ["year", "fund"], _sum: { amount: true } }),
  ]);

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<MemberStatus, number>;

  const years = Array.from(new Set(fundTotals.map((f) => f.year))).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Admin dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(Object.keys(STATUS_LABELS) as MemberStatus[]).map((status) => (
          <div key={status} className="border rounded-lg p-4">
            <p className="text-xs text-neutral-500">{STATUS_LABELS[status]}</p>
            <p className="text-lg font-semibold mt-1">{statusMap[status] ?? 0}</p>
          </div>
        ))}
        <div className="border rounded-lg p-4">
          <p className="text-xs text-neutral-500">Pending claims</p>
          <p className="text-lg font-semibold mt-1">{pendingClaims}</p>
        </div>
      </div>

      <section>
        <h2 className="font-medium mb-2">Funds collected by year</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Year</th>
              <th className="py-1">Burial fund</th>
              <th className="py-1">Food fund</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const burial = fundTotals.find((f) => f.year === year && f.fund === "BURIAL")?._sum.amount ?? 0;
              const food = fundTotals.find((f) => f.year === year && f.fund === "FOOD")?._sum.amount ?? 0;
              return (
                <tr key={year} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-1">{year}</td>
                  <td className="py-1">R {Number(burial).toFixed(2)}</td>
                  <td className="py-1">R {Number(food).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
