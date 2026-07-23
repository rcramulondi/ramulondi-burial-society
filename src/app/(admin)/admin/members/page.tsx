import { listMembersWithSummary } from "@/server/actions/member";
import { STATUS_LABELS } from "@/lib/statusLabels";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";
import { outstandingBalanceClass } from "@/lib/statusColors";
import Link from "next/link";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const { search, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { members, total, pageSize } = await listMembersWithSummary({ search, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    params.set("page", String(p));
    return `/admin/members?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-navy">Members ({total})</h1>
        <Link href="/admin/members/new" className="text-sm text-accent hover:underline">
          Add member
        </Link>
      </div>

      <form className="flex gap-2 text-sm">
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
              <th className="py-1 pr-3">Type</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1 pr-3">Joined</th>
              <th className="py-1 pr-3">Phone</th>
              <th className="py-1 pr-3">Email</th>
              <th className="py-1 pr-3 text-right">Beneficiaries</th>
              <th className="py-1 pr-3 text-right">Contributions to date</th>
              <th className="py-1 pr-3 text-right">Outstanding balance</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="py-1 pr-3">
                  <Link href={`/admin/members/${m.id}`} className="text-accent hover:underline">{m.membershipNo}</Link>
                </td>
                <td className="py-1 pr-3">{m.firstName} {m.surname}</td>
                <td className="py-1 pr-3">{m.type}</td>
                <td className="py-1 pr-3"><MemberStatusBadge status={m.status} /></td>
                <td className="py-1 pr-3">{m.dateJoined.toDateString()}</td>
                <td className="py-1 pr-3">{m.phone ?? "—"}</td>
                <td className="py-1 pr-3">{m.email ?? "—"}</td>
                <td className="py-1 pr-3 text-right">{m.beneficiaryCount}</td>
                <td className="py-1 pr-3 text-right">R {m.contributionsToDate.toFixed(2)}</td>
                <td className={`py-1 pr-3 text-right ${outstandingBalanceClass(m.outstandingBalance)}`}>R {m.outstandingBalance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex gap-2 text-sm items-center">
          {page > 1 && <Link href={pageHref(page - 1)} className="text-accent hover:underline">&larr; Previous</Link>}
          <span className="text-neutral-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={pageHref(page + 1)} className="text-accent hover:underline">Next &rarr;</Link>}
        </nav>
      )}
    </div>
  );
}
