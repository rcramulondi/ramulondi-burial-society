import { prisma } from "@/lib/prisma";
import {
  listUnallocatedFunds,
  countUnallocatedFunds,
  recordUnallocatedFundForm,
  allocateUnallocatedFundForm,
  markUnallocatedFundDuplicateForm,
  deleteUnallocatedFundForm,
} from "@/server/actions/unallocatedFund";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import FieldLabel from "@/components/forms/FieldLabel";
import FormKey from "@/components/forms/FormKey";
import DeleteButton from "@/components/forms/DeleteButton";
import Card from "@/components/ui/Card";
import SearchSelect from "@/components/ui/SearchSelect";
import Pagination from "@/components/ui/Pagination";
import { formatDate, formatCurrency } from "@/lib/format";
import { STATUS_COLOR_CLASSES, type StatusColor } from "@/lib/statusColors";
import { parsePage, totalPageCount } from "@/lib/pagination";

function fundStatus(f: { isDuplicate: boolean; remaining: number; amount: unknown }): { label: string; color: StatusColor } {
  if (f.isDuplicate) return { label: "Duplicate", color: "red" };
  if (f.remaining <= 0) return { label: "Fully allocated", color: "green" };
  if (f.remaining < Number(f.amount)) return { label: "Partially allocated", color: "amber" };
  return { label: "Unallocated", color: "grey" };
}

export default async function AdminUnallocatedFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const [funds, total, members] = await Promise.all([
    listUnallocatedFunds({ search, page }),
    countUnallocatedFunds({ search }),
    prisma.member.findMany({ orderBy: { surname: "asc" } }),
  ]);
  const totalPages = totalPageCount(total, 20);

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
          <FormKey />
          <Field label="Description / reference number" name="reference" helperText="Whatever text appears on the bank statement for this deposit, if any." />
          <Field label="Date of payment" name="depositDate" type="date" required />
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Type of deposit" required />
            <select name="depositType" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="CASH">Cash</option>
              <option value="EFT">EFT</option>
            </select>
          </label>
          <Field label="Amount (R)" name="amount" type="number" required />
          <Field label="Notes" name="notes" />
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Deposits ({total})</h2>
        <form className="flex gap-2 text-sm mb-4">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search reference"
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
                <th className="py-1 pr-3 hidden min-[820px]:table-cell">Reference</th>
                <th className="py-1 pr-3 hidden min-[820px]:table-cell">Type</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3 text-right hidden min-[480px]:table-cell">Allocated</th>
                <th className="py-1 pr-3 text-right">Remaining</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Allocate</th>
                <th className="py-1 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => {
                const status = fundStatus(f);
                return (
                  <tr key={f.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">{formatDate(f.depositDate)}</td>
                    <td className="py-2 pr-3 hidden min-[820px]:table-cell">{f.reference ?? "—"}</td>
                    <td className="py-2 pr-3 hidden min-[820px]:table-cell">{f.depositType}</td>
                    <td className="py-2 pr-3 text-right">{formatCurrency(f.amount)}</td>
                    <td className="py-2 pr-3 text-right hidden min-[480px]:table-cell">{formatCurrency(f.allocatedAmount)}</td>
                    <td className="py-2 pr-3 text-right font-medium">{formatCurrency(f.remaining)}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${STATUS_COLOR_CLASSES[status.color]}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {f.isDuplicate ? (
                        <span className="text-neutral-500 text-xs">Marked as duplicate</span>
                      ) : f.remaining > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-xs underline">Allocate</summary>
                          <ActionForm action={allocateUnallocatedFundForm} submitLabel="Allocate" className="flex flex-col gap-2 mt-2 max-w-xs">
                            <input type="hidden" name="unallocatedFundId" value={f.id} />
                            <label className="flex flex-col gap-1 text-sm">
                              <FieldLabel label="Member" required />
                              <SearchSelect
                                name="memberId"
                                placeholder="Search by name or membership no"
                                required
                                options={members.map((m) => ({
                                  value: m.id,
                                  label: `${m.firstName} ${m.surname} (${m.membershipNo})`,
                                }))}
                              />
                            </label>
                            <Field label={`Amount (max ${formatCurrency(f.remaining)})`} name="amount" type="number" required />
                          </ActionForm>
                        </details>
                      ) : (
                        <span className="text-neutral-500 text-xs">Fully allocated</span>
                      )}
                      {f.allocations.length > 0 && (
                        <ul className="text-xs text-neutral-500 mt-2">
                          {f.allocations.map((a) => (
                            <li key={a.id}>{formatCurrency(a.amount)} → {a.member.firstName} {a.member.surname}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-col gap-1 items-start">
                        <ActionForm
                          action={markUnallocatedFundDuplicateForm}
                          submitLabel={f.isDuplicate ? "Unmark duplicate" : "Mark duplicate"}
                          onSuccessMessage="Updated."
                          className="flex flex-col gap-1"
                        >
                          <input type="hidden" name="unallocatedFundId" value={f.id} />
                          <input type="hidden" name="isDuplicate" value={f.isDuplicate ? "false" : "true"} />
                        </ActionForm>
                        {f.allocations.length === 0 && (
                          <DeleteButton
                            action={deleteUnallocatedFundForm}
                            hiddenFields={{ unallocatedFundId: f.id }}
                            confirmMessage="Remove this unallocated deposit? This cannot be undone."
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {funds.length === 0 && (
                <tr><td colSpan={9} className="py-2 text-neutral-500">No unallocated deposits recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} basePath="/admin/unallocated-funds" params={{ search }} />
        </div>
      </Card>
    </div>
  );
}
