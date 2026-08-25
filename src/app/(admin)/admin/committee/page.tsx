import { prisma } from "@/lib/prisma";
import { listCurrentCommitteeHolders, listCommitteeHistory, countCommitteeHistory, assignCommitteeRoleForm } from "@/server/actions/committee";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import Card from "@/components/ui/Card";
import SearchSelect from "@/components/ui/SearchSelect";
import Pagination from "@/components/ui/Pagination";
import { formatDate } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import { Phone, Mail } from "lucide-react";

export default async function AdminCommitteePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const [holders, history, historyTotal, eligibleMembers] = await Promise.all([
    listCurrentCommitteeHolders(),
    listCommitteeHistory({ search, page }),
    countCommitteeHistory({ search }),
    prisma.member.findMany({
      where: { status: { in: ["ACTIVE", "ABOUT_TO_LAPSE"] } },
      orderBy: { surname: "asc" },
    }),
  ]);
  const totalPages = totalPageCount(historyTotal, 20);

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
                <th className="py-1 pr-3 hidden min-[820px]:table-cell">Phone</th>
                <th className="py-1 pr-3 hidden min-[820px]:table-cell">Email</th>
                <th className="py-1 pr-3 hidden min-[480px]:table-cell">Since</th>
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
                    <td className="py-2 pr-3 hidden min-[820px]:table-cell">
                      {holder?.member.phone ? (
                        <a
                          href={`tel:${holder.member.phone.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {holder.member.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 hidden min-[820px]:table-cell">
                      {holder?.member.email ? (
                        <a
                          href={`mailto:${holder.member.email}`}
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" /> {holder.member.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 hidden min-[480px]:table-cell">{holder ? formatDate(holder.startDate) : "—"}</td>
                    <td className="py-2 pr-3">
                      <details>
                        <summary className="cursor-pointer text-xs underline">Assign</summary>
                        <ActionForm action={assignCommitteeRoleForm} submitLabel="Assign" className="flex flex-col gap-2 mt-2 max-w-xs">
                          <input type="hidden" name="role" value={role} />
                          <label className="flex flex-col gap-1 text-sm">
                            <FieldLabel label="Member" required />
                            <SearchSelect
                              name="memberId"
                              placeholder="Search by name or membership no"
                              required
                              options={eligibleMembers.map((m) => ({
                                value: m.id,
                                label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
                              }))}
                            />
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
        <h2 className="font-medium mb-4 text-navy">History ({historyTotal})</h2>
        <form className="flex gap-2 text-sm mb-4">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search member name"
            className="border border-slate-300 rounded px-3 py-2 bg-white"
          />
          <button type="submit" className="border border-slate-300 rounded px-3 py-2 bg-white hover:bg-slate-50">
            Search
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Role</th>
                <th className="py-1 pr-3">Member</th>
                <th className="py-1 pr-3 hidden min-[480px]:table-cell">Start</th>
                <th className="py-1 pr-3">End</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{COMMITTEE_ROLE_LABELS[h.role]}</td>
                  <td className="py-1 pr-3">{h.member.firstName} {h.member.surname}</td>
                  <td className="py-1 pr-3 hidden min-[480px]:table-cell">{formatDate(h.startDate)}</td>
                  <td className="py-1 pr-3">{h.endDate ? formatDate(h.endDate) : <span className="text-accent">Current</span>}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-neutral-500">No committee history yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} basePath="/admin/committee" params={{ search }} />
        </div>
      </Card>
    </div>
  );
}
