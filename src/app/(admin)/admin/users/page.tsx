import {
  listManageableUsers,
  revokeAdminAccessForm,
  unlockUserAccountForm,
  reactivateMemberForm,
} from "@/server/actions/userAccount";
import { accountStatus, type AccountStatus } from "@/lib/accountStatus";
import { COMMITTEE_ROLE_LABELS } from "@/lib/statusLabels";

const ACCOUNT_STATUS_CLASSES: Record<AccountStatus, string> = {
  "No account": "text-slate-500 bg-slate-100 border-slate-200",
  Active: "text-success bg-success-bg border-success/30",
  Locked: "text-amber-700 bg-amber-50 border-amber-200",
  Disabled: "text-danger bg-danger-bg border-danger/30",
};
import InviteButton from "@/components/forms/InviteButton";
import ActionForm from "@/components/forms/ActionForm";
import Pagination from "@/components/ui/Pagination";
import { totalPageCount } from "@/lib/pagination";

const ROLE_FILTER_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "TREASURER", label: "Treasurer" },
  { value: "SECRETARY", label: "Secretary" },
  { value: "CHAIRPERSON", label: "Chairperson" },
];
const STATUS_FILTER_OPTIONS = ["No account", "Active", "Locked", "Disabled"];

export default async function ManageUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string; status?: string; page?: string }>;
}) {
  const { search, role, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { users, total, pageSize } = await listManageableUsers({ search, role, status, page });
  const totalPages = totalPageCount(total, pageSize);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">Manage users ({total})</h1>
      <p className="text-sm text-neutral-500">
        Admin roles are assigned independently of committee membership. Inactive (lapsed) members must be
        reactivated before they can be granted access.
      </p>

      <form className="flex gap-2 text-sm flex-wrap">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or membership no"
          className="border border-slate-300 rounded px-3 py-2 bg-white"
        />
        <select name="role" defaultValue={role ?? ""} className="border border-slate-300 rounded px-3 py-2 bg-white">
          <option value="">All roles</option>
          {ROLE_FILTER_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className="border border-slate-300 rounded px-3 py-2 bg-white">
          <option value="">All account statuses</option>
          {STATUS_FILTER_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
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
              <th className="py-1 pr-3">Name</th>
              <th className="py-1 pr-3 hidden min-[820px]:table-cell">Committee position</th>
              <th className="py-1 pr-3 hidden min-[480px]:table-cell">Role</th>
              <th className="py-1 pr-3">Account status</th>
              <th className="py-1 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3">{m.firstName} {m.surname} <span className="text-neutral-500">({m.membershipNo})</span></td>
                <td className="py-2 pr-3 hidden min-[820px]:table-cell">{m.committeeRole ? COMMITTEE_ROLE_LABELS[m.committeeRole] : "—"}</td>
                <td className="py-2 pr-3 hidden min-[480px]:table-cell">
                  {m.user?.role === "ADMIN" ? (
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border bg-primary-light text-accent border-accent/30">
                      Admin &middot; {m.user.adminGroup}
                    </span>
                  ) : (
                    <span className="text-neutral-500 text-xs">Member</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${ACCOUNT_STATUS_CLASSES[accountStatus(m.user)]}`}>
                    {accountStatus(m.user)}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex flex-col gap-2">
                    {m.status === "IN_ACTIVE" ? (
                      <ActionForm action={reactivateMemberForm} submitLabel="Reactivate member" className="flex flex-col gap-1">
                        <input type="hidden" name="memberId" value={m.id} />
                      </ActionForm>
                    ) : (
                      !m.user && <InviteButton memberId={m.id} />
                    )}

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
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-neutral-500">No members match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} basePath="/admin/users" params={{ search, role, status }} />
    </div>
  );
}
