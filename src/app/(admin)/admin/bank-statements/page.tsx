import {
  importBankStatement,
  createExpenseFromBankTransaction,
  listBankStatementImports,
  countBankStatementImports,
  listBankTransactions,
  countBankTransactions,
  listBankTransactionsByCategories,
  countBankTransactionsByCategories,
  getSavingsBalance,
} from "@/server/actions/bankStatement";
import { listCommitteeEligibleMembers } from "@/server/actions/expense";
import { COMMITTEE_ROLE_LABELS, COMMITTEE_ROLE_ORDER } from "@/lib/statusLabels";
import { formatDate, formatCurrency } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import ActionForm from "@/components/forms/ActionForm";
import FieldLabel from "@/components/forms/FieldLabel";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  TRANSFER_IN: "Transfer in (from savings)",
  TRANSFER_OUT: "Transfer out (to savings)",
  INTEREST: "Interest",
  BANK_FEE: "Bank fee",
};

const TRANSFER_FEE_INTEREST_CATEGORIES = ["TRANSFER_IN", "TRANSFER_OUT", "INTEREST", "BANK_FEE"] as const;

export default async function AdminBankStatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ importSearch?: string; importPage?: string; txSearch?: string; txPage?: string }>;
}) {
  const { importSearch, importPage: importPageParam, txSearch, txPage: txPageParam } = await searchParams;
  const importPage = parsePage(importPageParam);
  const txPage = parsePage(txPageParam);

  const [
    imports,
    importsTotal,
    expenseCandidates,
    transfersFeesInterest,
    transfersFeesInterestTotal,
    unmatchedCount,
    eligibleMembers,
    savingsBalance,
  ] = await Promise.all([
    listBankStatementImports({ search: importSearch, page: importPage }),
    countBankStatementImports({ search: importSearch }),
    listBankTransactions("EXPENSE_PENDING"),
    listBankTransactionsByCategories([...TRANSFER_FEE_INTEREST_CATEGORIES], { search: txSearch, page: txPage }),
    countBankTransactionsByCategories([...TRANSFER_FEE_INTEREST_CATEGORIES], { search: txSearch }),
    countBankTransactions("CONTRIBUTION_UNMATCHED"),
    listCommitteeEligibleMembers(),
    getSavingsBalance(),
  ]);
  const importTotalPages = totalPageCount(importsTotal, 20);
  const txTotalPages = totalPageCount(transfersFeesInterestTotal, 20);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold text-navy">Bank statements</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-neutral-500">Savings account balance</p>
          <p className="text-lg font-semibold mt-1 text-navy">{formatCurrency(savingsBalance)}</p>
        </Card>
        <Link href="/admin/unallocated-funds" className="block">
          <Card className="hover:border-accent transition-colors">
            <p className="text-xs text-neutral-500">Unmatched deposits awaiting manual matching</p>
            <p className="text-lg font-semibold mt-1 text-navy">{unmatchedCount} &rarr; view Unallocated Funds</p>
          </Card>
        </Link>
      </div>

      <Card className="max-w-lg">
        <h2 className="font-medium mb-4 text-navy">Import a statement</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Credits matching a membership number are recorded automatically. Everything else lands on
          the Unallocated Funds screen for manual matching, or below for expense review.
          Re-importing the same file is safe — duplicate rows are skipped.
        </p>
        <ActionForm action={importBankStatement} submitLabel="Import" onSuccessMessage="Import complete — see the summary below.">
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Account" required />
            <select name="accountType" required className="border border-slate-300 rounded px-3 py-2 bg-white">
              <option value="OPERATING">Operating account</option>
              <option value="SAVINGS">Savings / investment account</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <FieldLabel label="Statement file (CSV)" required />
            <input name="file" type="file" accept=".csv" required className="text-sm" />
          </label>
        </ActionForm>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Import history ({importsTotal})</h2>
        <form className="flex gap-2 text-sm mb-4">
          <input
            name="importSearch"
            defaultValue={importSearch}
            placeholder="Search file name"
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
                <th className="py-1 pr-3">Account</th>
                <th className="py-1 pr-3">File</th>
                <th className="py-1 pr-3 text-right">Transactions</th>
                <th className="py-1 pr-3 text-right">Closing balance</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{formatDate(imp.importedAt)}</td>
                  <td className="py-1 pr-3">{imp.accountType === "OPERATING" ? "Operating" : "Savings"}</td>
                  <td className="py-1 pr-3">
                    {imp.documents[0] ? (
                      <a href={`/api/documents/${imp.documents[0].id}`} target="_blank" className="text-accent hover:underline">
                        {imp.fileName}
                      </a>
                    ) : (
                      imp.fileName
                    )}
                  </td>
                  <td className="py-1 pr-3 text-right">{imp.transactionCount}</td>
                  <td className="py-1 pr-3 text-right">{formatCurrency(imp.closingBalance)}</td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr><td colSpan={5} className="py-2 text-neutral-500">No statements imported yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination
            page={importPage}
            totalPages={importTotalPages}
            basePath="/admin/bank-statements"
            pageParam="importPage"
            params={{ importSearch, txSearch, txPage: txPageParam }}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Needs review — expense candidates</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Debits that aren&apos;t bank fees or transfers to/from savings. Complete each one to record it as an expense.
        </p>
        <div className="flex flex-col gap-3">
          {expenseCandidates.map((t) => (
            <div key={t.id} className="border border-slate-200 rounded p-3 text-sm flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-navy">{t.description}</p>
                  <p className="text-neutral-500">{formatDate(t.date)} &middot; {formatCurrency(Math.abs(Number(t.amount)))}</p>
                </div>
              </div>
              <details>
                <summary className="cursor-pointer text-xs underline">Record as expense</summary>
                <ActionForm action={createExpenseFromBankTransaction} submitLabel="Save expense" className="flex flex-col gap-2 mt-2 max-w-sm">
                  <input type="hidden" name="bankTransactionId" value={t.id} />
                  <label className="flex flex-col gap-1 text-sm">
                    <FieldLabel label="Description" required />
                    <input
                      name="description"
                      required
                      defaultValue={t.description}
                      className="border border-slate-300 rounded px-3 py-2 bg-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <FieldLabel label="Member who spent the money" required />
                    <select name="spentByMemberId" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                      <option value="">Select a committee member</option>
                      {eligibleMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.firstName} {m.surname} ({m.membershipNo})</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <FieldLabel label="Approved by" required />
                    <select name="approvedByRole" required className="border border-slate-300 rounded px-3 py-2 bg-white">
                      {COMMITTEE_ROLE_ORDER.map((role) => (
                        <option key={role} value={role}>{COMMITTEE_ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <FieldLabel label="Receipt / slip" />
                    <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" className="text-xs" />
                    <span className="text-xs text-text-muted">Optional — the bank statement line itself is evidence of this expense.</span>
                  </label>
                </ActionForm>
              </details>
            </div>
          ))}
          {expenseCandidates.length === 0 && <p className="text-sm text-neutral-500">Nothing needs review.</p>}
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-4 text-navy">Transfers, interest &amp; fees ({transfersFeesInterestTotal})</h2>
        <p className="text-xs text-neutral-500 mb-4">
          Informational only — transfers to/from the savings account and bank-generated interest/fee
          lines aren&apos;t member contributions or committee expenses, so they&apos;re not part of
          either ledger.
        </p>
        <form className="flex gap-2 text-sm mb-4">
          <input
            name="txSearch"
            defaultValue={txSearch}
            placeholder="Search description"
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
                <th className="py-1 pr-3">Category</th>
                <th className="py-1 pr-3">Description</th>
                <th className="py-1 pr-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transfersFeesInterest.map((t) => (
                <tr key={t.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{formatDate(t.date)}</td>
                  <td className="py-1 pr-3">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                  <td className="py-1 pr-3">{t.description}</td>
                  <td className="py-1 pr-3 text-right">{formatCurrency(t.amount)}</td>
                </tr>
              ))}
              {transfersFeesInterest.length === 0 && (
                <tr><td colSpan={4} className="py-2 text-neutral-500">None recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination
            page={txPage}
            totalPages={txTotalPages}
            basePath="/admin/bank-statements"
            pageParam="txPage"
            params={{ txSearch, importSearch, importPage: importPageParam }}
          />
        </div>
      </Card>
    </div>
  );
}
