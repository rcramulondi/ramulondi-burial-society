import { prisma } from "@/lib/prisma";
import { getMonthlyFinancialBreakdown } from "@/lib/reports/annualFinancialSummary";
import IncomeExpenditureChart from "@/components/charts/IncomeExpenditureChart";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : currentYear;

  const [rows, allocationYears] = await Promise.all([
    getMonthlyFinancialBreakdown(year),
    prisma.paymentAllocation.findMany({ distinct: ["year"], select: { year: true } }),
  ]);
  const yearOptions = Array.from(new Set([currentYear, ...allocationYears.map((a) => a.year)])).sort((a, b) => b - a);

  const chartData = rows.map((r) => ({ month: MONTH_NAMES[r.month - 1], income: r.totalIncome, expenditure: r.totalExpenditure }));

  const totals = rows.reduce(
    (acc, r) => ({
      burialIncome: acc.burialIncome + r.burialIncome,
      foodIncome: acc.foodIncome + r.foodIncome,
      totalIncome: acc.totalIncome + r.totalIncome,
      burialExpenditure: acc.burialExpenditure + r.burialExpenditure,
      otherExpenses: acc.otherExpenses + r.otherExpenses,
      totalExpenditure: acc.totalExpenditure + r.totalExpenditure,
      net: acc.net + r.net,
    }),
    { burialIncome: 0, foodIncome: 0, totalIncome: 0, burialExpenditure: 0, otherExpenses: 0, totalExpenditure: 0, net: 0 }
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/admin/reports" className="text-sm text-accent hover:underline">&larr; Back to reports</Link>
          <h1 className="text-xl font-semibold text-navy mt-2">Income vs. expenditure ({year})</h1>
        </div>
        <form className="flex gap-2 text-sm flex-wrap">
          <select name="year" defaultValue={year} className="border border-slate-300 rounded px-3 py-2 bg-white">
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">Go</button>
        </form>
      </div>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Monthly income vs. expenditure</h2>
        <IncomeExpenditureChart data={chartData} />
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Detail breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Month</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Burial contributions</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Food contributions</th>
                <th className="py-1 pr-3 text-right">Total income</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Burial payouts</th>
                <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Other expenses</th>
                <th className="py-1 pr-3 text-right">Total expenditure</th>
                <th className="py-1 pr-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{MONTH_NAMES[r.month - 1]}</td>
                  <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(r.burialIncome)}</td>
                  <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(r.foodIncome)}</td>
                  <td className="py-1 pr-3 text-right">{formatCurrency(r.totalIncome)}</td>
                  <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">
                    <Link href={`/admin/claims?year=${year}`} className="text-accent hover:underline">{formatCurrency(r.burialExpenditure)}</Link>
                  </td>
                  <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">
                    <Link href="/admin/expenses" className="text-accent hover:underline">{formatCurrency(r.otherExpenses)}</Link>
                  </td>
                  <td className="py-1 pr-3 text-right">{formatCurrency(r.totalExpenditure)}</td>
                  <td className={`py-1 pr-3 text-right ${r.net >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(r.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-medium">
                <td className="py-1 pr-3">Total</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(totals.burialIncome)}</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(totals.foodIncome)}</td>
                <td className="py-1 pr-3 text-right">{formatCurrency(totals.totalIncome)}</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(totals.burialExpenditure)}</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(totals.otherExpenses)}</td>
                <td className="py-1 pr-3 text-right">{formatCurrency(totals.totalExpenditure)}</td>
                <td className={`py-1 pr-3 text-right ${totals.net >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
