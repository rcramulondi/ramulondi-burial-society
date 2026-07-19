import { auth } from "@/lib/auth";
import { getMemberContributionSummary } from "@/server/actions/payment";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function ContributionsPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;
  const summary = await getMemberContributionSummary(memberId);

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

        return (
          <section key={year}>
            <h2 className="font-medium mb-2">{year}</h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 text-sm">
              {monthTotals.map((amount, i) => (
                <div key={i} className="border rounded p-2 text-center">
                  <p className="text-xs text-neutral-500">{MONTH_NAMES[i]}</p>
                  <p className={amount > 0 ? "font-medium" : "text-neutral-400"}>
                    {amount > 0 ? `R${amount.toFixed(0)}` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {years.length === 0 && <p className="text-neutral-500">No contribution history yet.</p>}
    </div>
  );
}
