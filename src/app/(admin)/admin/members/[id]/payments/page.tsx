import { auth } from "@/lib/auth";
import { getMemberContributionSummary, recordPaymentForm, listMemberPayments } from "@/server/actions/payment";
import { prisma } from "@/lib/prisma";
import { computeFullRateForMonth } from "@/lib/business/contributionAllocation";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import Card from "@/components/ui/Card";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function MemberPaymentHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id: memberId } = await params;
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) : currentYear;

  const session = await auth();
  const canRecordPayment = session?.user.role === "ADMIN" && (session.user.adminGroup === "SUPER_ADMIN" || session.user.adminGroup === "TREASURER");

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
    const belowRate = periodDate <= currentMonthStart && amount < fullRate;

    // Distinct payments whose allocations land in this (year, month) — a
    // payment spanning multiple months' arrears legitimately shows under
    // each of those months, since it's genuinely proof for all of them.
    const paymentIds = Array.from(
      new Set(
        payments
          .filter((p) => p.allocations.some((a) => a.year === year && a.month === month))
          .map((p) => p.id)
      )
    );

    return { amount, belowRate, paymentIds };
  });

  return (
    <div className="flex flex-col gap-8">
      {canRecordPayment && (
        <Card className="max-w-md">
          <h2 className="font-medium mb-4 text-navy">Record a payment</h2>
          <ActionForm action={recordPaymentForm} submitLabel="Record payment">
            <input type="hidden" name="memberId" value={memberId} />
            <label className="flex flex-col gap-1 text-sm">
              Category
              <select name="category" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                <option value="MONTHLY_CONTRIBUTION">Monthly contribution (spread across outstanding months)</option>
                <option value="JOINING_FEE">Joining fee</option>
              </select>
            </label>
            <Field label="Amount (R)" name="amount" type="number" required />
            <Field label="Payment date" name="paymentDate" type="date" required />
            <Field label="Method (optional)" name="method" placeholder="Cash, EFT, ..." />
            <Field label="Reference (optional)" name="reference" />
            <label className="flex flex-col gap-1 text-sm">
              Proof of payment (optional)
              <input name="proofFile" type="file" accept=".jpg,.jpeg,.png,.pdf" className="text-sm" />
            </label>
          </ActionForm>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-navy">Monthly contributions</h2>
          <form className="flex gap-2 text-sm">
            <select
              name="year"
              defaultValue={year}
              className="border border-slate-300 rounded px-3 py-2 bg-white"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
              Go
            </button>
          </form>
        </div>
        <p className="text-xs text-neutral-500 mb-2">Months shown in red fell short of the full monthly rate.</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-sm">
          {monthRows.map((r, i) => (
            <div key={i} className="border border-slate-200 rounded p-2 text-center">
              <p className="text-xs text-neutral-500">{MONTH_NAMES[i]}</p>
              <p className={r.belowRate ? "font-bold text-red-700" : r.amount > 0 ? "font-medium text-navy" : "text-neutral-400"}>
                {r.amount > 0 ? `R${r.amount.toFixed(0)}` : "—"}
              </p>
              {r.paymentIds.map((paymentId) => (
                <a
                  key={paymentId}
                  href={`/api/reports/proof-of-payment/${paymentId}`}
                  target="_blank"
                  className="block text-accent hover:underline text-xs"
                >
                  Receipt
                </a>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
