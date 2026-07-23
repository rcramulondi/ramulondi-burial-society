import { Fragment } from "react";
import { listCurrentCommitteeHolders } from "@/server/actions/committee";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";

export default async function MemberCommitteePage() {
  const committeeHolders = await listCurrentCommitteeHolders();
  const holderByRole = new Map(committeeHolders.map((h) => [h.role, h]));

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Society committee</h1>
      <p className="text-xs text-neutral-500 mb-6">Current office holders (view only).</p>
      <dl className="text-sm grid grid-cols-2 gap-y-1">
        {COMMITTEE_ROLE_ORDER.map((role) => {
          const holder = holderByRole.get(role);
          return (
            <Fragment key={role}>
              <dt className="text-neutral-500">{COMMITTEE_ROLE_LABELS[role]}</dt>
              <dd>
                {holder ? `${holder.member.firstName} ${holder.member.surname}` : "Vacant"}
              </dd>
            </Fragment>
          );
        })}
      </dl>
    </div>
  );
}
