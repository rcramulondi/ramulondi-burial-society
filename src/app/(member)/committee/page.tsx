import { listCurrentCommitteeHolders } from "@/server/actions/committee";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";
import { Phone, Mail } from "lucide-react";

function initialsFor(firstName: string, surname: string): string {
  return `${firstName[0] ?? ""}${surname[0] ?? ""}`.toUpperCase();
}

export default async function MemberCommitteePage() {
  const committeeHolders = await listCurrentCommitteeHolders();
  const holderByRole = new Map(committeeHolders.map((h) => [h.role, h]));

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-2">Society committee</h1>
      <p className="text-xs text-neutral-500 mb-6">Current office holders (view only). Numbers and emails are tappable.</p>
      <div className="flex flex-col gap-2.5">
        {COMMITTEE_ROLE_ORDER.map((role) => {
          const holder = holderByRole.get(role);
          return (
            <div
              key={role}
              className={`border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 ${holder ? "" : "opacity-60"}`}
            >
              <div className="w-10 h-10 rounded-full bg-gold text-navy flex items-center justify-center text-sm font-bold shrink-0">
                {holder ? initialsFor(holder.member.firstName, holder.member.surname) : "—"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {COMMITTEE_ROLE_LABELS[role]}
                </p>
                {holder ? (
                  <>
                    <p className="text-sm font-semibold text-navy">
                      {holder.member.firstName} {holder.member.surname}
                    </p>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {holder.member.phone && (
                        <a
                          href={`tel:${holder.member.phone.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline w-fit"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {holder.member.phone}
                        </a>
                      )}
                      {holder.member.email && (
                        <a
                          href={`mailto:${holder.member.email}`}
                          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline w-fit"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" /> {holder.member.email}
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500 italic mt-1">Vacant</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
