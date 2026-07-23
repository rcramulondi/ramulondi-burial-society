import { prisma } from "@/lib/prisma";
import { listCurrentCommitteeHolders, listCommitteeHistory, assignCommitteeRoleForm } from "@/server/actions/committee";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import Card from "@/components/ui/Card";

export default async function AdminCommitteePage() {
  const [holders, history, eligibleMembers] = await Promise.all([
    listCurrentCommitteeHolders(),
    listCommitteeHistory(),
    prisma.member.findMany({
      where: { status: { in: ["ACTIVE", "ABOUT_TO_LAPSE"] } },
      orderBy: { surname: "asc" },
    }),
  ]);

  const holderByRole = new Map(holders.map((h) => [h.role, h]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Committee Members</h1>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Current holders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Role</th>
                <th className="py-1 pr-3">Held by</th>
                <th className="py-1 pr-3">Since</th>
                <th className="py-1 pr-3">Assign new holder</th>
              </tr>
            </thead>
            <tbody>
              {COMMITTEE_ROLE_ORDER.map((role) => {
                const holder = holderByRole.get(role);
                return (
                  <tr key={role} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 font-medium">{COMMITTEE_ROLE_LABELS[role]}</td>
                    <td className="py-2 pr-3">
                      {holder ? `${holder.member.firstName} ${holder.member.surname}` : <span className="text-neutral-500">Vacant</span>}
                    </td>
                    <td className="py-2 pr-3">{holder ? holder.startDate.toDateString() : "—"}</td>
                    <td className="py-2 pr-3">
                      <details>
                        <summary className="cursor-pointer text-xs underline">Assign</summary>
                        <ActionForm action={assignCommitteeRoleForm} submitLabel="Assign" className="flex flex-col gap-2 mt-2 max-w-xs">
                          <input type="hidden" name="role" value={role} />
                          <label className="flex flex-col gap-1 text-sm">
                            Member
                            <select name="memberId" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                              <option value="">Select a member</option>
                              {eligibleMembers.map((m) => (
                                <option key={m.id} value={m.id}>{m.firstName} {m.surname} ({m.membershipNo})</option>
                              ))}
                            </select>
                          </label>
                          <Field label="Start date" name="startDate" type="date" required />
                        </ActionForm>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Role</th>
                <th className="py-1 pr-3">Member</th>
                <th className="py-1 pr-3">Start</th>
                <th className="py-1 pr-3">End</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{COMMITTEE_ROLE_LABELS[h.role]}</td>
                  <td className="py-1 pr-3">{h.member.firstName} {h.member.surname}</td>
                  <td className="py-1 pr-3">{h.startDate.toDateString()}</td>
                  <td className="py-1 pr-3">{h.endDate ? h.endDate.toDateString() : <span className="text-accent">Current</span>}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-neutral-500">No committee history yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
