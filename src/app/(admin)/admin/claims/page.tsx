import { listClaims } from "@/server/actions/claim";
import { CLAIM_STATUS_LABELS } from "@/lib/statusLabels";
import Link from "next/link";

export default async function AdminClaimsPage() {
  const claims = await listClaims();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Claims</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Member</th>
            <th className="py-1">Date deceased</th>
            <th className="py-1">Status</th>
            <th className="py-1">Submitted</th>
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
              <td className="py-1">{c.dateDeceased.toDateString()}</td>
              <td className="py-1">{CLAIM_STATUS_LABELS[c.status]}</td>
              <td className="py-1">{c.submittedAt.toDateString()}</td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr><td colSpan={4} className="py-2 text-neutral-500">No claims submitted.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
