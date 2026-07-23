import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberContributionSummary, listMemberPayments } from "@/server/actions/payment";
import { computeFullRateForMonth } from "@/lib/business/contributionAllocation";
import { outstandingBalanceClass } from "@/lib/statusColors";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : currentYear;

  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const [summary, payments, rates] = await Promise.all([
    getMemberContributionSummary(memberId),
    listMemberPayments(memberId, { year }),
    prisma.contributionRate.findMany({ where: { membershipType: member.type } }),
  ]);

  const availableYears = Array.from(
    new Set([currentYear, ...summary.allocations.map((a) => a.year)])
  ).sort((a, b) => b - a);

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const monthRows = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const amount = summary.allocations
      .filter((a) => a.year === year && a.month === month)
      .reduce((sum, a) => sum + Number(a.amount), 0);
    const fullRate = computeFullRateForMonth(rates, member.type, year, month);
    const periodDate = new Date(Date.UTC(year, month - 1, 1));
    const isDue = periodDate <= currentMonthStart;
    const belowRate = isDue && amount < fullRate;
    return { month, monthName: MONTH_NAMES[i], amount, belowRate };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Contributions</h1>
        <p className="text-sm text-neutral-500">
          Outstanding balance: <span className={outstandingBalanceClass(summary.outstandingBalance)}>R {summary.outstandingBalance.toFixed(2)}</span>
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <form className="flex gap-2 text-sm">
          <select name="year" defaultValue={year} className="border rounded px-3 py-2 bg-transparent">
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="submit" className="border rounded px-3 py-2">Go</button>
        </form>
        <a href={`/api/reports/contribution-statement/${memberId}/${year}`} target="_blank" className="text-sm underline">
          Download my {year} statement
        </a>
      </div>

      <section>
        <h2 className="font-medium mb-1">{year} monthly breakdown</h2>
        <p className="text-xs text-neutral-500 mb-2">Months shown in red fell short of the full monthly rate.</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-sm mb-4">
          {monthRows.map((r) => (
            <div key={r.month} className="border rounded p-2 text-center">
              <p className="text-xs text-neutral-500">{r.monthName}</p>
              <p className={r.belowRate ? "font-bold text-red-700" : r.amount > 0 ? "font-medium" : "text-neutral-400"}>
                {r.amount > 0 ? `R${r.amount.toFixed(0)}` : "—"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {payments.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">Payments in {year}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">Date</th>
                  <th className="py-1">Category</th>
                  <th className="py-1 text-right">Burial</th>
                  <th className="py-1 text-right">Food</th>
                  <th className="py-1 text-right">Total</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const burial = p.allocations.filter((a) => a.fund === "BURIAL").reduce((s, a) => s + Number(a.amount), 0);
                  const food = p.allocations.filter((a) => a.fund === "FOOD").reduce((s, a) => s + Number(a.amount), 0);
                  return (
                    <tr key={p.id} className="border-b border-black/5">
                      <td className="py-1">{p.paymentDate.toDateString()}</td>
                      <td className="py-1">{p.category}</td>
                      <td className="py-1 text-right">{burial > 0 ? `R ${burial.toFixed(2)}` : "—"}</td>
                      <td className="py-1 text-right">{food > 0 ? `R ${food.toFixed(2)}` : "—"}</td>
                      <td className="py-1 text-right font-medium">R {Number(p.amount).toFixed(2)}</td>
                      <td className="py-1">
                        <a href={`/api/reports/proof-of-payment/${p.id}`} target="_blank" className="underline">
                          Receipt
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {payments.length === 0 && summary.allocations.length === 0 && (
        <p className="text-neutral-500">No contribution history yet.</p>
      )}
    </div>
  );
}
