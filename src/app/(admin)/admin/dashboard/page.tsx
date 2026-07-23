import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/statusLabels";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";
import { projectedForYear, getActiveCountsAndRates } from "@/lib/business/projectedContributions";
import { listUnallocatedFunds } from "@/server/actions/unallocatedFund";
import MemberStatusPieChart from "@/components/charts/MemberStatusPieChart";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { MemberStatus } from "@prisma/client";

export default async function AdminDashboardPage() {
  const [statusCounts, pendingClaims, fundTotals, { activeCounts, rates }, expenses, claimPayouts, unallocatedFunds] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: true }),
    prisma.claim.count({ where: { status: "PENDING" } }),
    prisma.paymentAllocation.groupBy({ by: ["year", "fund"], _sum: { amount: true } }),
    getActiveCountsAndRates(),
    prisma.expense.findMany({ select: { amount: true, expenseDate: true } }),
    prisma.claimPayout.findMany({ select: { amount: true, paidDate: true } }),
    listUnallocatedFunds(),
  ]);

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<MemberStatus, number>;
  const totalMembers = statusCounts.reduce((sum, s) => sum + s._count, 0);

  const pieData = (Object.keys(STATUS_LABELS) as MemberStatus[]).map((status) => {
    const count = statusMap[status] ?? 0;
    return {
      status,
      label: STATUS_LABELS[status],
      count,
      percent: totalMembers > 0 ? Math.round((count / totalMembers) * 1000) / 10 : 0,
    };
  });

  const years = Array.from(new Set(fundTotals.map((f) => f.year))).sort((a, b) => b - a);

  const totalCollectedAllYears = fundTotals.reduce((sum, f) => sum + Number(f._sum.amount ?? 0), 0);
  const unallocatedTotal = unallocatedFunds.reduce((sum, f) => sum + f.remaining, 0);

  const expensesByYear = (year: number) =>
    expenses.filter((e) => e.expenseDate.getUTCFullYear() === year).reduce((s, e) => s + Number(e.amount), 0);
  const claimPayoutsByYear = (year: number) =>
    claimPayouts.filter((p) => p.paidDate.getUTCFullYear() === year).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Admin dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(Object.keys(STATUS_LABELS) as MemberStatus[]).map((status) => (
          <Link key={status} href={`/admin/members?status=${status}`} className="block">
            <Card className="hover:border-accent transition-colors">
              <MemberStatusBadge status={status} />
              <p className="text-lg font-semibold mt-1 text-navy">{statusMap[status] ?? 0}</p>
            </Card>
          </Link>
        ))}
        <Link href="/admin/claims" className="block">
          <Card className="hover:border-accent transition-colors">
            <p className="text-xs text-neutral-500">Pending claims</p>
            <p className="text-lg font-semibold mt-1 text-navy">{pendingClaims}</p>
          </Card>
        </Link>
        <Card>
          <p className="text-xs text-neutral-500">Total collected (all years)</p>
          <p className="text-lg font-semibold mt-1 text-navy">R {totalCollectedAllYears.toFixed(2)}</p>
        </Card>
        <Link href="/admin/unallocated-funds" className="block">
          <Card className="hover:border-accent transition-colors">
            <p className="text-xs text-neutral-500">Unallocated funds</p>
            <p className="text-lg font-semibold mt-1 text-navy">R {unallocatedTotal.toFixed(2)}</p>
          </Card>
        </Link>
      </div>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Members by status</h2>
        <p className="text-xs text-neutral-500 mb-2">Click a status tile or a pie slice to see that list of members.</p>
        <MemberStatusPieChart data={pieData} />
      </Card>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Funds collected by year</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Projected uses current active membership counts applied to each month&apos;s effective rate —
          historical headcount isn&apos;t tracked, so treat this as an approximation. Click a year to drill
          into the monthly breakdown.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Year</th>
                <th className="py-1 pr-3 text-right">Burial fund</th>
                <th className="py-1 pr-3 text-right">Food fund</th>
                <th className="py-1 pr-3 text-right">Actual total</th>
                <th className="py-1 pr-3 text-right">Projected total</th>
                <th className="py-1 pr-3 text-right">Shortfall</th>
                <th className="py-1 pr-3 text-right">Burial expenditure</th>
                <th className="py-1 pr-3 text-right">Other expenses</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const burial = Number(fundTotals.find((f) => f.year === year && f.fund === "BURIAL")?._sum.amount ?? 0);
                const food = Number(fundTotals.find((f) => f.year === year && f.fund === "FOOD")?._sum.amount ?? 0);
                const actual = burial + food;
                const projected = projectedForYear(activeCounts, rates, year);
                const shortfall = Math.round((projected - actual) * 100) / 100;
                return (
                  <tr key={year} className="border-b border-slate-100">
                    <td className="py-1 pr-3">
                      <Link href={`/admin/dashboard/year/${year}`} className="text-accent hover:underline">{year}</Link>
                    </td>
                    <td className="py-1 pr-3 text-right">R {burial.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right">R {food.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right">R {actual.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right">R {projected.toFixed(2)}</td>
                    <td className={`py-1 pr-3 text-right ${shortfall > 0 ? "text-red-700" : "text-green-700"}`}>
                      <Link href={`/admin/dashboard/year/${year}`} className="hover:underline">
                        R {shortfall.toFixed(2)}
                      </Link>
                    </td>
                    <td className="py-1 pr-3 text-right">
                      <Link href={`/admin/claims?year=${year}`} className="text-accent hover:underline">
                        R {claimPayoutsByYear(year).toFixed(2)}
                      </Link>
                    </td>
                    <td className="py-1 pr-3 text-right">
                      <Link href="/admin/expenses" className="text-accent hover:underline">
                        R {expensesByYear(year).toFixed(2)}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
