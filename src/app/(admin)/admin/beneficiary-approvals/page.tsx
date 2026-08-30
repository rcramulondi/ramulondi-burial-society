import { listPendingBeneficiaryApprovals, countPendingBeneficiaryApprovals } from "@/server/actions/beneficiary";
import { RELATIONSHIP_LABELS } from "@/lib/statusLabels";
import { formatDateTime } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import Pagination from "@/components/ui/Pagination";
import Link from "next/link";

export default async function AdminBeneficiaryApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const [pending, total] = await Promise.all([
    listPendingBeneficiaryApprovals({ search, page }),
    countPendingBeneficiaryApprovals({ search }),
  ]);
  const totalPages = totalPageCount(total, 20);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">Beneficiary Approvals ({total})</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Beneficiaries submitted by members, awaiting review. Only the Secretary or a Super Admin can
          approve or reject — everyone else can view.
        </p>
      </div>

      <form className="flex gap-2 text-sm items-center flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search member or beneficiary name"
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        />
        <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
          Search
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th className="py-1 pr-3">Member</th>
              <th className="py-1 pr-3">Beneficiary</th>
              <th className="py-1 pr-3 hidden min-[480px]:table-cell">Relationship</th>
              <th className="py-1 pr-3 hidden min-[820px]:table-cell">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((b) => (
              <tr key={b.id} className="border-b border-slate-100">
                <td className="py-1 pr-3">
                  <Link href={`/admin/beneficiary-approvals/${b.id}`} className="text-accent hover:underline">
                    {b.member.firstName} {b.member.surname}
                  </Link>
                  <span className="text-neutral-500"> ({b.member.membershipNo})</span>
                </td>
                <td className="py-1 pr-3">{b.firstName} {b.surname}</td>
                <td className="py-1 pr-3 hidden min-[480px]:table-cell">{RELATIONSHIP_LABELS[b.relationship]}</td>
                <td className="py-1 pr-3 hidden min-[820px]:table-cell">{formatDateTime(b.createdAt)}</td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={4} className="py-2 text-neutral-500">Nothing awaiting approval.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/beneficiary-approvals" params={{ search }} />
    </div>
  );
}
