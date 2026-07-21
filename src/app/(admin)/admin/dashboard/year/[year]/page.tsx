import { prisma } from "@/lib/prisma";
import { projectedForMonth, getActiveCountsAndRates } from "@/lib/business/projectedContributions";
import MonthlyContributionChart from "@/components/charts/MonthlyContributionChart";
import Card from "@/components/ui/Card";
import Link from "next/link";
import { notFound } from "next/navigation";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function DashboardYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) notFound();

  const [monthlyTotals, monthlyAllocationMembers, allMembers, { activeCounts, rates }] = await Promise.all([
    prisma.paymentAllocation.groupBy({
      by: ["month", "fund"],
      where: { year },
      _sum: { amount: true },
    }),
    prisma.paymentAllocation.findMany({ where: { year }, select: { month: true, memberId: true } }),
    prisma.member.findMany({ select: { dateJoined: true, deceasedDate: true } }),
    getActiveCountsAndRates(),
  ]);

  const rows = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const burial = Number(monthlyTotals.find((m) => m.month === month && m.fund === "BURIAL")?._sum.amount ?? 0);
    const food = Number(monthlyTotals.find((m) => m.month === month && m.fund === "FOOD")?._sum.amount ?? 0);
    const actual = Math.round((burial + food) * 100) / 100;
    const projected = projectedForMonth(activeCounts, rates, year, month);
    const variance = Math.round((actual - projected) * 100) / 100;

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const contributorCount = new Set(
      monthlyAllocationMembers.filter((a) => a.month === month).map((a) => a.memberId)
    ).size;
    const eligibleCount = allMembers.filter(
      (m) => m.dateJoined <= monthStart && (!m.deceasedDate || m.deceasedDate >= monthStart)
    ).length;

    return { month, monthName: MONTH_NAMES[i], burial, food, actual, projected, variance, contributorCount, eligibleCount };
  });

  const yearActual = Math.round(rows.reduce((s, r) => s + r.actual, 0) * 100) / 100;
  const yearBurial = Math.round(rows.reduce((s, r) => s + r.burial, 0) * 100) / 100;
  const yearFood = Math.round(rows.reduce((s, r) => s + r.food, 0) * 100) / 100;
  const burialPercent = yearActual > 0 ? Math.round((yearBurial / yearActual) * 1000) / 10 : 0;
  const foodPercent = yearActual > 0 ? Math.round((yearFood / yearActual) * 1000) / 10 : 0;

  const chartData = rows.map((r) => ({ month: r.monthName, actual: r.actual, projected: r.projected }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/dashboard" className="text-sm text-accent hover:underline">&larr; Back to dashboard</Link>
        <h1 className="text-xl font-semibold text-navy mt-2">{year} contributions</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Split: Burial fund {burialPercent}% &middot; Food fund {foodPercent}% of R {yearActual.toFixed(2)} collected.
        </p>
      </div>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Actual vs. projected, by month</h2>
        <MonthlyContributionChart data={chartData} />
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Monthly breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Month</th>
                <th className="py-1 pr-3 text-right">Burial fund</th>
                <th className="py-1 pr-3 text-right">Food fund</th>
                <th className="py-1 pr-3 text-right">Actual</th>
                <th className="py-1 pr-3 text-right">Projected</th>
                <th className="py-1 pr-3 text-right">Variance</th>
                <th className="py-1 pr-3 text-right">Contributors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{r.monthName}</td>
                  <td className="py-1 pr-3 text-right">R {r.burial.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-right">R {r.food.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-right">R {r.actual.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-right">R {r.projected.toFixed(2)}</td>
                  <td className={`py-1 pr-3 text-right ${r.variance < 0 ? "text-red-700" : "text-green-700"}`}>
                    R {r.variance.toFixed(2)}
                  </td>
                  <td className="py-1 pr-3 text-right">
                    {r.contributorCount} / {r.eligibleCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
