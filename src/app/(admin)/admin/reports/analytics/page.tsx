import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/statusLabels";
import { getAnnualFinancialSummary, getMonthlyFinancialBreakdown } from "@/lib/reports/annualFinancialSummary";
import { listUnallocatedFunds } from "@/server/actions/unallocatedFund";
import MemberStatusPieChart from "@/components/charts/MemberStatusPieChart";
import IncomeExpenditureChart from "@/components/charts/IncomeExpenditureChart";
import FundSplitChart from "@/components/charts/FundSplitChart";
import ExpenditureSplitPieChart from "@/components/charts/ExpenditureSplitPieChart";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { MemberStatus } from "@prisma/client";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function AnalyticsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : currentYear;

  const [statusCounts, monthlyBreakdown, annualSummary, unallocatedFunds, allMembers, allocationYears] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: true }),
    getMonthlyFinancialBreakdown(year),
    getAnnualFinancialSummary(year),
    listUnallocatedFunds(),
    prisma.member.findMany({ select: { dateJoined: true, status: true } }),
    prisma.paymentAllocation.findMany({ distinct: ["year"], select: { year: true } }),
  ]);

  const yearOptions = Array.from(new Set([currentYear, ...allocationYears.map((a) => a.year)])).sort((a, b) => b - a);

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<MemberStatus, number>;
  const totalMembers = statusCounts.reduce((sum, s) => sum + s._count, 0);
  const statusPieData = (Object.keys(STATUS_LABELS) as MemberStatus[]).map((status) => {
    const count = statusMap[status] ?? 0;
    return { status, label: STATUS_LABELS[status], count, percent: totalMembers > 0 ? Math.round((count / totalMembers) * 1000) / 10 : 0 };
  });

  const incomeExpenditureData = monthlyBreakdown.map((r) => ({
    month: MONTH_NAMES[r.month - 1],
    income: r.totalIncome,
    expenditure: r.totalExpenditure,
  }));
  const fundSplitData = monthlyBreakdown.map((r) => ({
    month: MONTH_NAMES[r.month - 1],
    burial: r.burialIncome,
    food: r.foodIncome,
  }));
  const expenditurePieData = [
    { label: "Burial payouts", amount: annualSummary.burialExpenditureTotal },
    { label: "Other expenses", amount: annualSummary.otherExpenseTotal },
  ];

  const unallocatedTotal = unallocatedFunds.reduce((sum, f) => sum + f.remaining, 0);

  // Membership growth by join-year cohort: cumulative membership as of each
  // year, split by CURRENT status. Only current status is tracked (no
  // historical snapshots exist), so this is an honest "attrition by cohort"
  // view rather than a fabricated year-by-year historical trend.
  const joinYears = allMembers.map((m) => m.dateJoined.getUTCFullYear());
  const minYear = joinYears.length > 0 ? Math.min(...joinYears) : currentYear;
  const growthYears = Array.from({ length: currentYear - minYear + 1 }, (_, i) => minYear + i);
  const growthData = growthYears.map((y) => {
    const cohort = allMembers.filter((m) => m.dateJoined.getUTCFullYear() <= y);
    const row: Record<string, number | string> = { year: String(y) };
    for (const status of Object.keys(STATUS_LABELS) as MemberStatus[]) {
      row[STATUS_LABELS[status]] = cohort.filter((m) => m.status === status).length;
    }
    return row;
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/admin/reports" className="text-sm text-accent hover:underline">&larr; Back to reports</Link>
          <h1 className="text-xl font-semibold text-navy mt-2">Analytics dashboard</h1>
        </div>
        <form className="flex gap-2 text-sm">
          <select name="year" defaultValue={year} className="border border-slate-300 rounded px-3 py-2 bg-white">
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">Go</button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-neutral-500">Total members</p>
          <p className="text-lg font-semibold mt-1 text-navy">{totalMembers}</p>
        </Card>
        <Card>
          <p className="text-xs text-neutral-500">Unallocated funds</p>
          <p className="text-lg font-semibold mt-1 text-navy">R {unallocatedTotal.toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-xs text-neutral-500">Net position ({year})</p>
          <p className={`text-lg font-semibold mt-1 ${annualSummary.net >= 0 ? "text-green-700" : "text-red-700"}`}>
            R {annualSummary.net.toFixed(2)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-2 text-navy">Membership by status</h2>
          <MemberStatusPieChart data={statusPieData} />
        </Card>

        <Card>
          <h2 className="font-medium mb-2 text-navy">Burial payouts vs. other expenses ({year})</h2>
          <ExpenditureSplitPieChart data={expenditurePieData} />
        </Card>

        <Card>
          <h2 className="font-medium mb-2 text-navy">Contributions vs. expenditure per month ({year})</h2>
          <IncomeExpenditureChart data={incomeExpenditureData} />
        </Card>

        <Card>
          <h2 className="font-medium mb-2 text-navy">Food vs. burial fund split per month ({year})</h2>
          <FundSplitChart data={fundSplitData} />
        </Card>
      </div>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Membership growth by join-year cohort</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Only current member status is tracked (no historical snapshots), so this shows cumulative membership
          as of each join year, broken down by each cohort&apos;s status today — not a year-by-year historical trend.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Year</th>
                {(Object.keys(STATUS_LABELS) as MemberStatus[]).map((s) => (
                  <th key={s} className="py-1 pr-3 text-right">{STATUS_LABELS[s]}</th>
                ))}
                <th className="py-1 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {growthData.map((row) => {
                const total = (Object.keys(STATUS_LABELS) as MemberStatus[]).reduce((s, k) => s + Number(row[STATUS_LABELS[k]] ?? 0), 0);
                return (
                  <tr key={row.year} className="border-b border-slate-100">
                    <td className="py-1 pr-3">{row.year}</td>
                    {(Object.keys(STATUS_LABELS) as MemberStatus[]).map((s) => (
                      <td key={s} className="py-1 pr-3 text-right">{row[STATUS_LABELS[s]]}</td>
                    ))}
                    <td className="py-1 pr-3 text-right font-medium">{total}</td>
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
