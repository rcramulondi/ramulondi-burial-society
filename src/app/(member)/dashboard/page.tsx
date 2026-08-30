import { auth } from "@/lib/auth";
import { getMemberDetail } from "@/server/actions/member";
import { getMemberContributionSummary } from "@/server/actions/payment";
import { getMemberPayoutSummary } from "@/server/actions/claim";
import { listUpcomingMeetings } from "@/server/actions/meeting";
import { CLAIM_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/statusLabels";
import { MemberStatusBadge, BeneficiaryStatusBadge } from "@/components/ui/StatusBadge";
import { outstandingBalanceClass } from "@/lib/statusColors";
import { formatDate, formatCurrency } from "@/lib/format";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default async function MemberDashboardPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;

  const [member, summary, payoutSummary, upcomingMeetings] = await Promise.all([
    getMemberDetail(memberId),
    getMemberContributionSummary(memberId),
    getMemberPayoutSummary(memberId),
    listUpcomingMeetings(),
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

      {upcomingMeetings.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">Upcoming meetings</h2>
          <ul className="flex flex-col gap-2">
            {upcomingMeetings.map((m) => (
              <li key={m.id} className="border rounded p-3 text-sm">
                <p className="font-medium">{MEETING_TYPE_LABELS[m.type]}</p>
                <p className="text-neutral-500">
                  {formatDate(m.date)} &middot; {m.venue} &middot; Hosted by {m.hostMember.firstName} {m.hostMember.surname}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/meetings" className="text-sm text-accent hover:underline mt-2 inline-block">
            View all meetings &rarr;
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Outstanding balance"
          value={formatCurrency(summary.outstandingBalance)}
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
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Year</th>
              <th className="py-1 hidden min-[480px]:table-cell">Burial fund</th>
              <th className="py-1 hidden min-[480px]:table-cell">Food fund</th>
              <th className="py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.byYear.map((y) => (
              <tr key={y.year} className="border-b border-black/5 dark:border-white/10">
                <td className="py-1">
                  <Link href={`/dashboard/year/${y.year}`} className="text-accent hover:underline">{y.year}</Link>
                </td>
                <td className="py-1 hidden min-[480px]:table-cell">{formatCurrency(y.byFund.BURIAL)}</td>
                <td className="py-1 hidden min-[480px]:table-cell">{formatCurrency(y.byFund.FOOD)}</td>
                <td className="py-1 font-medium">{formatCurrency(y.total)}</td>
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
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Beneficiaries</h2>
        <ul className="text-sm flex flex-col gap-2">
          {member.beneficiaries.map((b) => (
            <li key={b.id} className="flex items-center gap-2">
              <span>{b.firstName} {b.surname} &middot; {b.relationship}</span>
              <BeneficiaryStatusBadge status={b.status} />
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
            <span className="font-medium">{formatCurrency(payoutSummary.total)}</span>.
          </p>
          <ul className="text-sm flex flex-col gap-1">
            {payoutSummary.payouts.map((p) => (
              <li key={p.id}>
                {formatCurrency(p.amount)} paid to {p.paidTo} on {formatDate(p.paidDate)}
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
