import { auth } from "@/lib/auth";
import { listExpenses, countExpenses, listCommitteeEligibleMembers, resolveApprovingCommitteeRole, createExpense } from "@/server/actions/expense";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import FormKey from "@/components/forms/FormKey";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import { formatDate, formatCurrency } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const session = await auth();
  const [expenses, total, eligibleMembers, autoRole] = await Promise.all([
    listExpenses({ search, page }),
    countExpenses({ search }),
    listCommitteeEligibleMembers(),
    resolveApprovingCommitteeRole(session?.user.memberId),
  ]);
  const totalPages = totalPageCount(total, 20);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Expenses</h1>

      <Card className="max-w-lg">
        <h2 className="font-medium mb-4 text-navy">Record an expense</h2>
        <p className="text-xs text-neutral-500 mb-4">A receipt or slip is required for every expense.</p>
        <ActionForm action={createExpense} submitLabel="Record expense" sticky>
          <FormKey />
          <Field label="Description" name="description" required />
          <Field label="Amount (R)" name="amount" type="number" required helperText="Enter the total Rand amount spent, including any VAT." />
          <Field label="Date of expense" name="expenseDate" type="date" required />
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Member who spent the money" required />
            <select name="spentByMemberId" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="">Select a committee member</option>
              {eligibleMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.surname} ({m.membershipNo})</option>
              ))}
            </select>
          </label>
          {autoRole ? (
            <div className="text-sm">
              Approved by: <span className="font-medium">{COMMITTEE_ROLE_LABELS[autoRole]}</span>
              <input type="hidden" name="approvedByRole" value={autoRole} />
            </div>
          ) : (
            <label className="flex flex-col gap-1 text-sm">
              <FieldLabel label="Approved by" required />
              <select name="approvedByRole" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                {COMMITTEE_ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>{COMMITTEE_ROLE_LABELS[role]}</option>
                ))}
              </select>
              <span className="text-xs text-text-muted">Your login isn&apos;t linked to a current committee member, so pick which role is approving this expense.</span>
            </label>
          )}
          <Field label="Notes" name="notes" helperText="Any extra context for this expense." />
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Receipt / slip" required />
            <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
            <span className="text-xs text-text-muted">JPEG, PNG, or PDF, max 5MB.</span>
          </label>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Recorded expenses ({total})</h2>
        <form className="flex gap-2 text-sm mb-4">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search description or spent-by name"
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
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Description</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3 hidden min-[820px]:table-cell">Spent by</th>
                <th className="py-1 pr-3 hidden min-[820px]:table-cell">Approved by</th>
                <th className="py-1 pr-3">Slip</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{formatDate(e.expenseDate)}</td>
                  <td className="py-1 pr-3">{e.description}</td>
                  <td className="py-1 pr-3 text-right">{formatCurrency(e.amount)}</td>
                  <td className="py-1 pr-3 hidden min-[820px]:table-cell">{e.spentByMember.firstName} {e.spentByMember.surname}</td>
                  <td className="py-1 pr-3 hidden min-[820px]:table-cell">{COMMITTEE_ROLE_LABELS[e.approvedByRole]}</td>
                  <td className="py-1 pr-3">
                    {e.documents.map((d) => (
                      <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" className="text-accent hover:underline">
                        {d.fileName}
                      </a>
                    ))}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={6} className="py-2 text-neutral-500">No expenses recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} basePath="/admin/expenses" params={{ search }} />
        </div>
      </Card>
    </div>
  );
}
