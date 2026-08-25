import { listCurrentCommitteeHolders } from "@/server/actions/committee";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";

export default async function MemberCommitteePage() {
  const committeeHolders = await listCurrentCommitteeHolders();
  const holderByRole = new Map(committeeHolders.map((h) => [h.role, h]));

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Society committee</h1>
      <p className="text-xs text-neutral-500 mb-6">Current office holders (view only).</p>
      <div className="flex flex-col">
        {COMMITTEE_ROLE_ORDER.map((role) => {
          const holder = holderByRole.get(role);
          return (
            <div key={role} className="border-b border-slate-100 py-3 first:pt-0">
              <p className="text-sm font-medium text-navy">{COMMITTEE_ROLE_LABELS[role]}</p>
              {holder ? (
                <div className="text-sm mt-1">
                  <p>{holder.member.firstName} {holder.member.surname}</p>
                  {holder.member.phone && <p className="text-neutral-500">{holder.member.phone}</p>}
                  {holder.member.email && <p className="text-neutral-500">{holder.member.email}</p>}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 mt-1">Vacant</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
