import { listMembersWithSummary } from "@/server/actions/member";
import { STATUS_LABELS } from "@/lib/statusLabels";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import { formatDate, formatCurrency } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import Link from "next/link";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const { search, status, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const { members, total, pageSize } = await listMembersWithSummary({ search, status, page });
  const totalPages = totalPageCount(total, pageSize);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-navy">Members ({total})</h1>
        <Link href="/admin/members/new" className="text-sm text-accent hover:underline">
          Add member
        </Link>
      </div>

      <form className="flex gap-2 text-sm flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or membership no"
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        />
        <select name="status" defaultValue={status ?? ""} className="border border-slate-300 rounded px-3 py-2 bg-white">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
          <option value="DRAFT">Draft</option>
        </select>
        <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th className="py-1 pr-3">Membership No</th>
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1 pr-3 hidden min-[820px]:table-cell">Phone</th>
              <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Beneficiaries</th>
              <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Claims</th>
              <th className="py-1 pr-3 text-right hidden min-[820px]:table-cell">Contributions ({new Date().getFullYear()})</th>
              <th className="py-1 pr-3 hidden min-[480px]:table-cell">Date of termination</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="py-1 pr-3">
                  <Link href={`/admin/members/${m.id}`} className="text-accent hover:underline">{m.membershipNo}</Link>
                </td>
                <td className="py-1 pr-3">{m.firstName} {m.surname}</td>
                <td className="py-1 pr-3">
                  {m.isDraft ? (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border text-amber-700 bg-amber-50 border-amber-200 whitespace-nowrap">
                      Draft
                    </span>
                  ) : (
                    <MemberStatusBadge status={m.status} />
                  )}
                </td>
                <td className="py-1 pr-3 hidden min-[820px]:table-cell">{m.phone ?? "—"}</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{m.beneficiaryCount}</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{m.claimsCount}</td>
                <td className="py-1 pr-3 text-right hidden min-[820px]:table-cell">{formatCurrency(m.contributionsThisYear)}</td>
                <td className="py-1 pr-3 hidden min-[480px]:table-cell">
                  {m.status === "IN_ACTIVE" && m.terminationDate ? (
                    formatDate(m.terminationDate)
                  ) : m.status === "ABOUT_TO_LAPSE" && m.projectedTerminationDate ? (
                    <span className="font-bold text-danger">{formatDate(m.projectedTerminationDate)}</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/members" params={{ search, status }} />
    </div>
  );
}
