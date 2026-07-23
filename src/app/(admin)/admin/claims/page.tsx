import { listClaims } from "@/server/actions/claim";
import { prisma } from "@/lib/prisma";
import { CLAIM_STATUS_LABELS } from "@/lib/statusLabels";
import Link from "next/link";

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : undefined;

  const [claims, payoutYears] = await Promise.all([
    listClaims({ year }),
    prisma.claimPayout.findMany({ distinct: ["paidDate"], select: { paidDate: true } }),
  ]);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set([currentYear, ...payoutYears.map((p) => p.paidDate.getUTCFullYear())])
  ).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Claims</h1>

      <form className="flex gap-2 text-sm items-center">
        <select name="year" defaultValue={year ?? ""} className="border rounded px-3 py-2 bg-transparent">
          <option value="">All years (by payout)</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="border rounded px-3 py-2">Filter</button>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Member</th>
            <th className="py-1">Deceased</th>
            <th className="py-1">Date deceased</th>
            <th className="py-1">Status</th>
            <th className="py-1">Submitted</th>
            <th className="py-1 text-right">Payout</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id} className="border-b border-black/5 dark:border-white/10">
              <td className="py-1">
                <Link href={`/admin/claims/${c.id}`} className="underline">
                  {c.member.firstName} {c.member.surname}
                </Link>
              </td>
              <td className="py-1">
                {c.beneficiary ? `${c.beneficiary.firstName} ${c.beneficiary.surname} (${c.beneficiary.relationship})` : "Member (policyholder)"}
              </td>
              <td className="py-1">{c.dateDeceased.toDateString()}</td>
              <td className="py-1">{CLAIM_STATUS_LABELS[c.status]}</td>
              <td className="py-1">{c.submittedAt.toDateString()}</td>
              <td className="py-1 text-right">{c.payout ? `R ${Number(c.payout.amount).toFixed(2)}` : "—"}</td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr><td colSpan={6} className="py-2 text-neutral-500">No claims found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
