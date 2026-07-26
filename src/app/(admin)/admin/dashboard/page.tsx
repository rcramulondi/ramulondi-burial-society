import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/statusLabels";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";
import { projectedForYear, getActiveCountsAndRates } from "@/lib/business/projectedContributions";
import { getMemberStatusCountsAsOf } from "@/lib/business/memberStatus";
import { listUnallocatedFunds } from "@/server/actions/unallocatedFund";
import MemberStatusPieChart from "@/components/charts/MemberStatusPieChart";
import Card from "@/components/ui/Card";
import DeltaPill from "@/components/ui/DeltaPill";
import Link from "next/link";
import { FileClock, Banknote, HandCoins, Receipt, Coins } from "lucide-react";
import type { MemberStatus } from "@prisma/client";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const isConsolidated = yearParam === "consolidated";
  const selectedYear = !isConsolidated && yearParam ? Number(yearParam) : currentYear;

  const [statusCounts, pendingClaims, fundTotals, { activeCounts, rates }, expenses, claimPayouts, unallocatedFunds] = await Promise.all([
    prisma.member.groupBy({ by: ["status"], _count: true }),
    prisma.claim.count({ where: { status: "PENDING" } }),
    prisma.paymentAllocation.groupBy({ by: ["year", "fund"], _sum: { amount: true } }),
    getActiveCountsAndRates(),
    prisma.expense.findMany({ select: { amount: true, expenseDate: true } }),
    prisma.claimPayout.findMany({ select: { amount: true, paidDate: true } }),
    listUnallocatedFunds(),
  ]);

  const liveStatusMap = Object.fromEntries(statusCounts.map((s) => [s.status, s._count])) as Record<MemberStatus, number>;

  // Member-status tiles/pie chart: for the current year or the consolidated
  // (all-time) view, "as of now" IS the answer, so the live snapshot is used
  // directly. For a past year, reconstruct the breakdown as it stood at the
  // end of that year from MemberStatusHistory — falling back to the live
  // snapshot (with a note) if history doesn't go back that far yet.
  const isCurrentSnapshot = isConsolidated || selectedYear === currentYear;
  let statusMap = liveStatusMap;
  let statusNote: string | null = null;
  if (!isCurrentSnapshot) {
    const cutoff = new Date(Date.UTC(selectedYear + 1, 0, 1));
    const { counts, hasFullHistory } = await getMemberStatusCountsAsOf(cutoff);
    if (hasFullHistory) {
      statusMap = counts;
    } else {
      statusNote = `Historical status tracking doesn't go back far enough to reconstruct ${selectedYear} yet — showing today's status instead.`;
    }
  }
  const totalMembers = (Object.keys(STATUS_LABELS) as MemberStatus[]).reduce((sum, s) => sum + (statusMap[s] ?? 0), 0);

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
  const yearOptions = Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a);

  const unallocatedTotal = unallocatedFunds.reduce((sum, f) => sum + f.remaining, 0);

  const expensesByYear = (year: number) =>
    expenses.filter((e) => e.expenseDate.getUTCFullYear() === year).reduce((s, e) => s + Number(e.amount), 0);
  const claimPayoutsByYear = (year: number) =>
    claimPayouts.filter((p) => p.paidDate.getUTCFullYear() === year).reduce((s, p) => s + Number(p.amount), 0);
  const totalCollectedByYear = (year: number) => {
    const burial = Number(fundTotals.find((f) => f.year === year && f.fund === "BURIAL")?._sum.amount ?? 0);
    const food = Number(fundTotals.find((f) => f.year === year && f.fund === "FOOD")?._sum.amount ?? 0);
    return burial + food;
  };

  // Financial tiles: "this year" or "all years" (consolidated) based on the
  // selector. Unallocated Funds is a running balance by nature, not
  // year-bound, so it's unaffected by this selector.
  const totalCollected = isConsolidated
    ? fundTotals.reduce((sum, f) => sum + Number(f._sum.amount ?? 0), 0)
    : totalCollectedByYear(selectedYear);
  const burialPayoutsSelected = isConsolidated
    ? claimPayouts.reduce((s, p) => s + Number(p.amount), 0)
    : claimPayoutsByYear(selectedYear);
  const otherExpensesSelected = isConsolidated
    ? expenses.reduce((s, e) => s + Number(e.amount), 0)
    : expensesByYear(selectedYear);

  // Real year-over-year deltas — only meaningful (and only rendered) for a
  // single selected year, never fabricated for the consolidated view.
  const priorYear = selectedYear - 1;
  const totalCollectedPrior = totalCollectedByYear(priorYear);
  const burialPayoutsPrior = claimPayoutsByYear(priorYear);
  const otherExpensesPrior = expensesByYear(priorYear);

  const selectionLabel = isConsolidated ? "all years" : String(selectedYear);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-navy">Admin dashboard</h1>
        <form className="flex gap-2 text-sm flex-wrap">
          <select name="year" defaultValue={isConsolidated ? "consolidated" : selectedYear} className="border border-slate-300 rounded px-3 py-2 bg-white">
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
            <option value="consolidated">All years (consolidated)</option>
          </select>
          <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
            Go
          </button>
        </form>
      </div>

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
            <p className="text-xs text-neutral-500 flex items-center gap-1.5"><FileClock className="w-3.5 h-3.5" /> Pending claims</p>
            <p className="text-lg font-semibold mt-1 text-navy">{pendingClaims}</p>
          </Card>
        </Link>
        <Card>
          <p className="text-xs text-neutral-500 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Total collected ({selectionLabel})</p>
          <p className="text-lg font-semibold mt-1 text-navy">R {totalCollected.toFixed(2)}</p>
          {!isConsolidated && <DeltaPill current={totalCollected} previous={totalCollectedPrior} />}
        </Card>
        <Link href={isConsolidated ? "/admin/claims" : `/admin/claims?year=${selectedYear}`} className="block">
          <Card className="hover:border-accent transition-colors">
            <p className="text-xs text-neutral-500 flex items-center gap-1.5"><HandCoins className="w-3.5 h-3.5" /> Burial payouts ({selectionLabel})</p>
            <p className="text-lg font-semibold mt-1 text-navy">R {burialPayoutsSelected.toFixed(2)}</p>
            {!isConsolidated && <DeltaPill current={burialPayoutsSelected} previous={burialPayoutsPrior} />}
          </Card>
        </Link>
        <Link href="/admin/expenses" className="block">
          <Card className="hover:border-accent transition-colors">
            <p className="text-xs text-neutral-500 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Other expenses ({selectionLabel})</p>
            <p className="text-lg font-semibold mt-1 text-navy">R {otherExpensesSelected.toFixed(2)}</p>
            {!isConsolidated && <DeltaPill current={otherExpensesSelected} previous={otherExpensesPrior} />}
          </Card>
        </Link>
        <Link href="/admin/unallocated-funds" className="block">
          <Card className="hover:border-accent transition-colors">
            <p className="text-xs text-neutral-500 flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Unallocated funds</p>
            <p className="text-lg font-semibold mt-1 text-navy">R {unallocatedTotal.toFixed(2)}</p>
          </Card>
        </Link>
      </div>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Members by status ({isCurrentSnapshot ? "today" : selectionLabel})</h2>
        <p className="text-xs text-neutral-500 mb-2">Click a status tile or a pie slice to see that list of members.</p>
        {statusNote && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">{statusNote}</p>
        )}
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
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Burial fund</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Food fund</th>
                <th className="py-1 pr-3 text-right">Actual total</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Projected total</th>
                <th className="py-1 pr-3 text-right">Shortfall</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Burial expenditure</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Other expenses</th>
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
                    <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">R {burial.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">R {food.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right">R {actual.toFixed(2)}</td>
                    <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">R {projected.toFixed(2)}</td>
                    <td className={`py-1 pr-3 text-right ${shortfall > 0 ? "text-danger" : "text-success"}`}>
                      <Link href={`/admin/dashboard/year/${year}`} className="hover:underline">
                        R {shortfall.toFixed(2)}
                      </Link>
                    </td>
                    <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">
                      <Link href={`/admin/claims?year=${year}`} className="text-accent hover:underline">
                        R {claimPayoutsByYear(year).toFixed(2)}
                      </Link>
                    </td>
                    <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">
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
