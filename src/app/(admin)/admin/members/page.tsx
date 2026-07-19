import { listMembers } from "@/server/actions/member";
import { STATUS_LABELS } from "@/lib/statusLabels";
import Link from "next/link";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const { search, status } = await searchParams;
  const members = await listMembers({ search, status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Members ({members.length})</h1>
        <Link href="/admin/members/new" className="text-sm underline">
          Add member
        </Link>
      </div>

      <form className="flex gap-2 text-sm">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or membership no"
          className="border rounded px-3 py-2 bg-transparent"
        />
        <select name="status" defaultValue={status ?? ""} className="border rounded px-3 py-2 bg-transparent">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="border rounded px-3 py-2">Filter</button>
      </form>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Membership No</th>
            <th className="py-1">Name</th>
            <th className="py-1">Type</th>
            <th className="py-1">Status</th>
            <th className="py-1">Joined</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-black/5 dark:border-white/10">
              <td className="py-1">
                <Link href={`/admin/members/${m.id}`} className="underline">{m.membershipNo}</Link>
              </td>
              <td className="py-1">{m.firstName} {m.surname}</td>
              <td className="py-1">{m.type}</td>
              <td className="py-1">{STATUS_LABELS[m.status]}</td>
              <td className="py-1">{m.dateJoined.toDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
