import { getMemberContributionSummary, recordPaymentForm, listMemberPayments } from "@/server/actions/payment";
import { uploadDocument } from "@/server/actions/document";
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

  const [summary, payments] = await Promise.all([
    getMemberContributionSummary(memberId),
    listMemberPayments(memberId, { year }),
  ]);

  const availableYears = Array.from(
    new Set([currentYear, ...summary.allocations.map((a) => a.year)])
  ).sort((a, b) => b - a);

  const monthTotals = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return summary.allocations
      .filter((a) => a.year === year && a.month === month)
      .reduce((sum, a) => sum + Number(a.amount), 0);
  });

  return (
    <div className="flex flex-col gap-8">
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
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-sm">
          {monthTotals.map((amount, i) => (
            <div key={i} className="border border-slate-200 rounded p-2 text-center">
              <p className="text-xs text-neutral-500">{MONTH_NAMES[i]}</p>
              <p className={amount > 0 ? "font-medium text-navy" : "text-neutral-400"}>
                {amount > 0 ? `R${amount.toFixed(0)}` : "—"}
              </p>
            </div>
          ))}
        </div>
      </Card>

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
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Payment history ({year})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Category</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3">Method</th>
                <th className="py-1 pr-3">Reference</th>
                <th className="py-1 pr-3">Proof of payment</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">{p.paymentDate.toDateString()}</td>
                  <td className="py-2 pr-3">{p.category}</td>
                  <td className="py-2 pr-3 text-right">R {Number(p.amount).toFixed(2)}</td>
                  <td className="py-2 pr-3">{p.method ?? "—"}</td>
                  <td className="py-2 pr-3">{p.reference ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-col gap-1">
                      {p.documents.map((d) => (
                        <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" className="text-accent hover:underline text-xs">
                          {d.fileName}
                        </a>
                      ))}
                      <a href={`/api/reports/proof-of-payment/${p.id}`} target="_blank" className="text-accent hover:underline text-xs">
                        Download receipt
                      </a>
                      <details>
                        <summary className="cursor-pointer text-xs underline">Upload proof</summary>
                        <ActionForm action={uploadDocument} submitLabel="Upload" className="flex flex-col gap-2 mt-2">
                          <input type="hidden" name="memberId" value={memberId} />
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input type="hidden" name="ownerType" value="PAYMENT_PROOF" />
                          <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-xs" />
                        </ActionForm>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-neutral-500">No payments recorded for {year}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
