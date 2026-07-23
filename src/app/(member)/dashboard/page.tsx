import { auth } from "@/lib/auth";
import { getMemberDetail } from "@/server/actions/member";
import { getMemberContributionSummary } from "@/server/actions/payment";
import { getMemberPayoutSummary } from "@/server/actions/claim";
import { CLAIM_STATUS_LABELS } from "@/lib/statusLabels";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";
import { outstandingBalanceClass } from "@/lib/statusColors";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default async function MemberDashboardPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;

  const [member, summary, payoutSummary] = await Promise.all([
    getMemberDetail(memberId),
    getMemberContributionSummary(memberId),
    getMemberPayoutSummary(memberId),
  ]);

  if (!member) return <p>Member record not found.</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            Welcome, {member.firstName} {member.surname}
          </h1>
          <p className="text-sm text-neutral-500 flex items-center gap-2">
            <span>Membership No: {member.membershipNo}</span>
            <MemberStatusBadge status={member.status} />
          </p>
        </div>
        <div className="flex gap-2">
          <Button href="/beneficiaries" variant="secondary">Add beneficiary</Button>
          <Button href="/claims/new">File a claim</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Outstanding balance"
          value={`R ${summary.outstandingBalance.toFixed(2)}`}
          valueClassName={outstandingBalanceClass(summary.outstandingBalance)}
        />
        <StatCard label="Beneficiaries" value={String(member.beneficiaries.length)} />
        <StatCard
          label="Claim status"
          value={member.claims.length > 0 ? member.claims.map((c) => CLAIM_STATUS_LABELS[c.status]).join(", ") : "No claim on file"}
        />
      </div>

      <section>
        <h2 className="font-medium mb-2">Contributions by year</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Year</th>
              <th className="py-1">Burial fund</th>
              <th className="py-1">Food fund</th>
              <th className="py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.byYear.map((y) => (
              <tr key={y.year} className="border-b border-black/5 dark:border-white/10">
                <td className="py-1">
                  <Link href={`/dashboard/year/${y.year}`} className="text-accent hover:underline">{y.year}</Link>
                </td>
                <td className="py-1">R {y.byFund.BURIAL.toFixed(2)}</td>
                <td className="py-1">R {y.byFund.FOOD.toFixed(2)}</td>
                <td className="py-1 font-medium">R {y.total.toFixed(2)}</td>
              </tr>
            ))}
            {summary.byYear.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-neutral-500">
                  No contributions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-medium mb-2">Beneficiaries</h2>
        <ul className="text-sm flex flex-col gap-1">
          {member.beneficiaries.map((b) => (
            <li key={b.id}>
              {b.firstName} {b.surname} &middot; {b.relationship}
            </li>
          ))}
          {member.beneficiaries.length === 0 && (
            <li className="text-neutral-500">No beneficiaries added yet.</li>
          )}
        </ul>
      </section>

      {payoutSummary.count > 0 && (
        <section>
          <h2 className="font-medium mb-2">Payouts</h2>
          <p className="text-sm text-neutral-500 mb-2">
            {payoutSummary.count} claim{payoutSummary.count === 1 ? "" : "s"} paid out, totalling{" "}
            <span className="font-medium">R {payoutSummary.total.toFixed(2)}</span>.
          </p>
          <ul className="text-sm flex flex-col gap-1">
            {payoutSummary.payouts.map((p) => (
              <li key={p.id}>
                R {Number(p.amount).toFixed(2)} paid to {p.paidTo} on {p.paidDate.toDateString()}
                {p.claim.beneficiary && ` (${p.claim.beneficiary.firstName} ${p.claim.beneficiary.surname})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="border rounded-lg p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}
