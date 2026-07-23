import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeFullRateForMonth } from "@/lib/business/contributionAllocation";
import Card from "@/components/ui/Card";
import Link from "next/link";
import { notFound } from "next/navigation";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function MemberDashboardYearPage({ params }: { params: Promise<{ year: string }> }) {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) notFound();

  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const [allocations, rates] = await Promise.all([
    prisma.paymentAllocation.findMany({ where: { memberId, year } }),
    prisma.contributionRate.findMany({ where: { membershipType: member.type } }),
  ]);

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const rows = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const burial = allocations.filter((a) => a.month === month && a.fund === "BURIAL").reduce((s, a) => s + Number(a.amount), 0);
    const food = allocations.filter((a) => a.month === month && a.fund === "FOOD").reduce((s, a) => s + Number(a.amount), 0);
    const actual = Math.round((burial + food) * 100) / 100;
    const fullRate = computeFullRateForMonth(rates, member.type, year, month);
    const periodDate = new Date(Date.UTC(year, month - 1, 1));
    const isDue = periodDate <= currentMonthStart;
    const belowRate = isDue && actual < fullRate;

    return { month, monthName: MONTH_NAMES[i], burial, food, actual, fullRate, belowRate };
  });

  const yearActual = Math.round(rows.reduce((s, r) => s + r.actual, 0) * 100) / 100;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard" className="text-sm text-accent hover:underline">&larr; Back to dashboard</Link>
        <h1 className="text-xl font-semibold text-navy mt-2">{year} contributions</h1>
        <p className="text-sm text-neutral-500 mt-1">R {yearActual.toFixed(2)} collected this year.</p>
      </div>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Monthly breakdown</h2>
        <p className="text-xs text-neutral-500 mb-4">Months shown in red fell short of the full monthly rate.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Month</th>
                <th className="py-1 pr-3 text-right">Burial fund</th>
                <th className="py-1 pr-3 text-right">Food fund</th>
                <th className="py-1 pr-3 text-right">Actual</th>
                <th className="py-1 pr-3 text-right">Full rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{r.monthName}</td>
                  <td className="py-1 pr-3 text-right">R {r.burial.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-right">R {r.food.toFixed(2)}</td>
                  <td className={`py-1 pr-3 text-right ${r.belowRate ? "font-bold text-red-700" : ""}`}>
                    R {r.actual.toFixed(2)}
                  </td>
                  <td className="py-1 pr-3 text-right text-neutral-500">R {r.fullRate.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
