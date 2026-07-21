import { auth } from "@/lib/auth";
import { getMemberContributionSummary, listMemberPayments } from "@/server/actions/payment";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function ContributionsPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const [summary, payments] = await Promise.all([
    getMemberContributionSummary(memberId),
    listMemberPayments(memberId),
  ]);

  const years = Array.from(new Set(summary.allocations.map((a) => a.year))).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Contributions</h1>
        <p className="text-sm text-neutral-500">
          Outstanding balance: <span className="font-medium">R {summary.outstandingBalance.toFixed(2)}</span>
        </p>
      </div>

      {years.map((year) => {
        const monthTotals = Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const amount = summary.allocations
            .filter((a) => a.year === year && a.month === month)
            .reduce((sum, a) => sum + Number(a.amount), 0);
          return amount;
        });
        const yearPayments = payments.filter((p) => p.paymentDate.getUTCFullYear() === year);

        return (
          <section key={year}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">{year}</h2>
              <a href={`/api/reports/contribution-statement/${memberId}/${year}`} target="_blank" className="text-sm underline">
                Download my {year} statement
              </a>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-sm mb-4">
              {monthTotals.map((amount, i) => (
                <div key={i} className="border rounded p-2 text-center">
                  <p className="text-xs text-neutral-500">{MONTH_NAMES[i]}</p>
                  <p className={amount > 0 ? "font-medium" : "text-neutral-400"}>
                    {amount > 0 ? `R${amount.toFixed(0)}` : "—"}
                  </p>
                </div>
              ))}
            </div>

            {yearPayments.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1">Date</th>
                      <th className="py-1">Category</th>
                      <th className="py-1 text-right">Amount</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearPayments.map((p) => (
                      <tr key={p.id} className="border-b border-black/5 dark:border-white/10">
                        <td className="py-1">{p.paymentDate.toDateString()}</td>
                        <td className="py-1">{p.category}</td>
                        <td className="py-1 text-right">R {Number(p.amount).toFixed(2)}</td>
                        <td className="py-1">
                          <a href={`/api/reports/proof-of-payment/${p.id}`} target="_blank" className="underline">
                            Receipt
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {years.length === 0 && <p className="text-neutral-500">No contribution history yet.</p>}
    </div>
  );
}
