import { auth } from "@/lib/auth";
import { listExpenses, listCommitteeEligibleMembers, resolveApprovingCommitteeRole, createExpense } from "@/server/actions/expense";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import Card from "@/components/ui/Card";

export default async function AdminExpensesPage() {
  const session = await auth();
  const [expenses, eligibleMembers, autoRole] = await Promise.all([
    listExpenses(),
    listCommitteeEligibleMembers(),
    resolveApprovingCommitteeRole(session?.user.memberId),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Expenses</h1>

      <Card className="max-w-lg">
        <h2 className="font-medium mb-4 text-navy">Record an expense</h2>
        <p className="text-xs text-neutral-500 mb-4">A receipt or slip is required for every expense.</p>
        <ActionForm action={createExpense} submitLabel="Record expense">
          <Field label="Description" name="description" required />
          <Field label="Amount (R)" name="amount" type="number" required />
          <Field label="Date of expense" name="expenseDate" type="date" required />
          <label className="flex flex-col gap-1 text-sm">
            Member who spent the money
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
              Approved by (your login isn&apos;t linked to a current committee member — select which role is approving)
              <select name="approvedByRole" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                {COMMITTEE_ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>{COMMITTEE_ROLE_LABELS[role]}</option>
                ))}
              </select>
            </label>
          )}
          <Field label="Notes (optional)" name="notes" />
          <label className="flex flex-col gap-1 text-sm">
            Receipt / slip (JPEG, PNG, or PDF, max 5MB)
            <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-sm" />
          </label>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Recorded expenses</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Description</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3">Spent by</th>
                <th className="py-1 pr-3">Approved by</th>
                <th className="py-1 pr-3">Slip</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{e.expenseDate.toDateString()}</td>
                  <td className="py-1 pr-3">{e.description}</td>
                  <td className="py-1 pr-3 text-right">R {Number(e.amount).toFixed(2)}</td>
                  <td className="py-1 pr-3">{e.spentByMember.firstName} {e.spentByMember.surname}</td>
                  <td className="py-1 pr-3">{COMMITTEE_ROLE_LABELS[e.approvedByRole]}</td>
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
      </Card>
    </div>
  );
}
