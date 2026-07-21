import { prisma } from "@/lib/prisma";
import { listUnallocatedFunds, recordUnallocatedFundForm, allocateUnallocatedFundForm } from "@/server/actions/unallocatedFund";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import Card from "@/components/ui/Card";

export default async function AdminUnallocatedFundsPage() {
  const [funds, members] = await Promise.all([
    listUnallocatedFunds(),
    prisma.member.findMany({ orderBy: { surname: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Unallocated funds</h1>

      <Card className="max-w-md">
        <h2 className="font-medium mb-4 text-navy">Record a deposit</h2>
        <p className="text-xs text-neutral-500 mb-4">
          For payments received without a clear member identification yet — allocate them once the
          recon is done.
        </p>
        <ActionForm action={recordUnallocatedFundForm} submitLabel="Record deposit">
          <Field label="Description / reference number" name="reference" />
          <Field label="Date of payment" name="depositDate" type="date" required />
          <label className="flex flex-col gap-1 text-sm">
            Type of deposit
            <select name="depositType" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="CASH">Cash</option>
              <option value="EFT">EFT</option>
            </select>
          </label>
          <Field label="Amount (R)" name="amount" type="number" required />
          <Field label="Notes (optional)" name="notes" />
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Deposits</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Reference</th>
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3 text-right">Allocated</th>
                <th className="py-1 pr-3 text-right">Remaining</th>
                <th className="py-1 pr-3">Allocate</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">{f.depositDate.toDateString()}</td>
                  <td className="py-2 pr-3">{f.reference ?? "—"}</td>
                  <td className="py-2 pr-3">{f.depositType}</td>
                  <td className="py-2 pr-3 text-right">R {Number(f.amount).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right">R {f.allocatedAmount.toFixed(2)}</td>
                  <td className="py-2 pr-3 text-right font-medium">R {f.remaining.toFixed(2)}</td>
                  <td className="py-2 pr-3">
                    {f.remaining > 0 ? (
                      <details>
                        <summary className="cursor-pointer text-xs underline">Allocate</summary>
                        <ActionForm action={allocateUnallocatedFundForm} submitLabel="Allocate" className="flex flex-col gap-2 mt-2 max-w-xs">
                          <input type="hidden" name="unallocatedFundId" value={f.id} />
                          <label className="flex flex-col gap-1 text-sm">
                            Member
                            <select name="memberId" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                              <option value="">Select a member</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>{m.firstName} {m.surname} ({m.membershipNo})</option>
                              ))}
                            </select>
                          </label>
                          <Field label={`Amount (max R${f.remaining.toFixed(2)})`} name="amount" type="number" required />
                        </ActionForm>
                      </details>
                    ) : (
                      <span className="text-neutral-500 text-xs">Fully allocated</span>
                    )}
                    {f.allocations.length > 0 && (
                      <ul className="text-xs text-neutral-500 mt-2">
                        {f.allocations.map((a) => (
                          <li key={a.id}>R {Number(a.amount).toFixed(2)} → {a.member.firstName} {a.member.surname}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
              {funds.length === 0 && (
                <tr><td colSpan={7} className="py-2 text-neutral-500">No unallocated deposits recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
