import { listClaims, countClaims } from "@/server/actions/claim";
import { prisma } from "@/lib/prisma";
import { CLAIM_STATUS_LABELS } from "@/lib/statusLabels";
import { formatDate, formatCurrency } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import Pagination from "@/components/ui/Pagination";
import Link from "next/link";
import type { ClaimStatus } from "@prisma/client";

const CLAIM_STATUS_CLASSES: Record<ClaimStatus, string> = {
  PENDING: "text-amber-700 bg-amber-50 border-amber-200",
  APPROVED: "text-accent bg-primary-light border-accent/30",
  REJECTED: "text-danger bg-danger-bg border-danger/30",
  PAID: "text-success bg-success-bg border-success/30",
};

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; search?: string; page?: string }>;
}) {
  const { year: yearParam, search, page: pageParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : undefined;
  const page = parsePage(pageParam);

  const [claims, total, payoutYears] = await Promise.all([
    listClaims({ year, search, page }),
    countClaims({ year, search }),
    prisma.claimPayout.findMany({ distinct: ["paidDate"], select: { paidDate: true } }),
  ]);
  const totalPages = totalPageCount(total, 20);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from(
    new Set([currentYear, ...payoutYears.map((p) => p.paidDate.getUTCFullYear())])
  ).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">Claims ({total})</h1>

      <form className="flex gap-2 text-sm items-center flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search member or deceased name"
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        />
        <select name="year" defaultValue={year ?? ""} className="border border-slate-300 rounded px-3 py-2 bg-white">
          <option value="">All years (by payout)</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">Filter</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th className="py-1 pr-3">Member</th>
              <th className="py-1 pr-3 hidden min-[820px]:table-cell">Deceased</th>
              <th className="py-1 pr-3 hidden min-[820px]:table-cell">Date deceased</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1 pr-3 hidden min-[820px]:table-cell">Submitted</th>
              <th className="py-1 pr-3 text-right hidden min-[480px]:table-cell">Payout</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-1 pr-3">
                  <Link href={`/admin/claims/${c.id}`} className="text-accent hover:underline">
                    {c.member.firstName} {c.member.surname}
                  </Link>
                </td>
                <td className="py-1 pr-3 hidden min-[820px]:table-cell">
                  {c.beneficiary ? `${c.beneficiary.firstName} ${c.beneficiary.surname} (${c.beneficiary.relationship})` : "Member (policyholder)"}
                </td>
                <td className="py-1 pr-3 hidden min-[820px]:table-cell">{formatDate(c.dateDeceased)}</td>
                <td className="py-1 pr-3">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${CLAIM_STATUS_CLASSES[c.status]}`}>
                    {CLAIM_STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="py-1 pr-3 hidden min-[820px]:table-cell">{formatDate(c.submittedAt)}</td>
                <td className="py-1 pr-3 text-right hidden min-[480px]:table-cell">{c.payout ? formatCurrency(c.payout.amount) : "—"}</td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr><td colSpan={6} className="py-2 text-neutral-500">No claims found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/claims" params={{ search, year: yearParam }} />
    </div>
  );
}
