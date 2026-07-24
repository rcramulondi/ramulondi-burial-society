import { listManageableUsers, setAdminGroupForm, revokeAdminAccessForm, unlockUserAccountForm } from "@/server/actions/userAccount";
import { COMMITTEE_ROLE_LABELS } from "@/lib/statusLabels";
import InviteButton from "@/components/forms/InviteButton";
import ActionForm from "@/components/forms/ActionForm";
import Modal from "@/components/ui/Modal";

const ADMIN_GROUPS: { value: string; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "SECRETARY", label: "Secretary" },
  { value: "CHAIRPERSON", label: "Chairperson (view only)" },
];

function accountStatusLabel(user: { disabled: boolean; lockedUntil: Date | null } | null): string {
  if (!user) return "No account";
  if (user.disabled) return "Disabled";
  if (user.lockedUntil && user.lockedUntil > new Date()) return "Locked";
  return "Active";
}

export default async function ManageUsersPage() {
  const users = await listManageableUsers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">Manage users</h1>
      <p className="text-sm text-neutral-500">
        Admin access is tied to current committee membership — Super Admin is the only exception.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3">Committee position</th>
              <th className="py-1 pr-3">Role</th>
              <th className="py-1 pr-3">Account status</th>
              <th className="py-1 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3">{m.firstName} {m.surname} <span className="text-neutral-500">({m.membershipNo})</span></td>
                <td className="py-2 pr-3">{m.committeeRole ? COMMITTEE_ROLE_LABELS[m.committeeRole] : "—"}</td>
                <td className="py-2 pr-3">
                  {m.user?.role === "ADMIN" ? (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                      Admin &middot; {m.user.adminGroup}
                    </span>
                  ) : (
                    <span className="text-neutral-500 text-xs">Member</span>
                  )}
                </td>
                <td className="py-2 pr-3">{accountStatusLabel(m.user)}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-col gap-2">
                    {!m.user && <InviteButton memberId={m.id} />}

                    <Modal triggerLabel={m.user?.role === "ADMIN" ? "Change admin group" : "Grant admin access"} title={`Admin access — ${m.firstName} ${m.surname}`}>
                      <ActionForm action={setAdminGroupForm} submitLabel="Save">
                        <input type="hidden" name="memberId" value={m.id} />
                        <label className="flex flex-col gap-1 text-sm">
                          Admin group
                          <select name="group" required defaultValue={m.user?.adminGroup ?? ""} className="border border-slate-300 rounded px-3 py-2 bg-white">
                            <option value="" disabled>Select a group</option>
                            {ADMIN_GROUPS.map((g) => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                        </label>
                        {m.committeeRole && (
                          <p className="text-xs text-neutral-500">
                            Current committee position ({COMMITTEE_ROLE_LABELS[m.committeeRole]}) is only eligible for a matching group.
                          </p>
                        )}
                      </ActionForm>
                    </Modal>

                    {m.user?.role === "ADMIN" && (
                      <ActionForm action={revokeAdminAccessForm} submitLabel="Revoke admin access" className="flex flex-col gap-1">
                        <input type="hidden" name="memberId" value={m.id} />
                      </ActionForm>
                    )}

                    {m.user?.lockedUntil && m.user.lockedUntil > new Date() && (
                      <ActionForm action={unlockUserAccountForm} submitLabel="Unlock account" className="flex flex-col gap-1">
                        <input type="hidden" name="userId" value={m.user.id} />
                      </ActionForm>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
