import { requireAdmin } from "@/server/permissions";
import { prisma } from "@/lib/prisma";

export default async function AdminAuditLogPage() {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">When</th>
            <th className="py-1">Entity</th>
            <th className="py-1">Action</th>
            <th className="py-1">Performed by</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-black/5 dark:border-white/10">
              <td className="py-1">{l.createdAt.toLocaleString()}</td>
              <td className="py-1">{l.entityType} ({l.entityId.slice(0, 8)}...)</td>
              <td className="py-1">{l.action}</td>
              <td className="py-1">{l.performedByUserId.slice(0, 8)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
