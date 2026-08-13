import { listAuditLogs, countAuditLogs } from "@/server/actions/auditLog";
import { parsePage, totalPageCount } from "@/lib/pagination";
import Pagination from "@/components/ui/Pagination";

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const [logs, total] = await Promise.all([
    listAuditLogs({ search, page }),
    countAuditLogs({ search }),
  ]);
  const totalPages = totalPageCount(total, 20);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">Audit log ({total})</h1>

      <form className="flex gap-2 text-sm">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search entity type, entity id, or user id"
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        />
        <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
          Search
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">When</th>
              <th className="py-1">Entity</th>
              <th className="py-1">Action</th>
              <th className="py-1 hidden min-[480px]:table-cell">Performed by</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-1">{l.createdAt.toLocaleString()}</td>
                <td className="py-1">{l.entityType} ({l.entityId.slice(0, 8)}...)</td>
                <td className="py-1">{l.action}</td>
                <td className="py-1 hidden min-[480px]:table-cell">{l.performedByUserId.slice(0, 8)}...</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="py-2 text-neutral-500">No audit log entries found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/audit-log" params={{ search }} />
    </div>
  );
}
