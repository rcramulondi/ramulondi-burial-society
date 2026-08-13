import { listRecentPayments, countRecentPayments } from "@/server/actions/payment";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import { formatDate, formatCurrency } from "@/lib/format";
import { parsePage, totalPageCount } from "@/lib/pagination";
import Link from "next/link";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const [payments, total, allocationYears] = await Promise.all([
    listRecentPayments({ search, page }),
    countRecentPayments({ search }),
    prisma.paymentAllocation.findMany({ distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
  ]);
  const totalPages = totalPageCount(total, 20);
  const currentYear = new Date().getFullYear();
  const years = Array.from(new Set([currentYear, ...allocationYears.map((a) => a.year)])).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-navy">Reports</h1>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Analytics dashboard</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Membership and financial charts: status split, contributions vs. expenditure, fund split, and membership growth.
        </p>
        <Link href="/admin/reports/analytics" className="text-accent hover:underline text-sm">Open analytics dashboard</Link>
      </Card>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Income vs. expenditure statement</h2>
        <p className="text-sm text-neutral-500 mb-4">Monthly income and expenditure with a detailed breakdown for a given year.</p>
        <Link href="/admin/reports/income-statement" className="text-accent hover:underline text-sm">Open income statement</Link>
      </Card>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Society statement</h2>
        <p className="text-sm text-neutral-500 mb-4">Every member&apos;s contribution total for a given year.</p>
        <ul className="flex flex-wrap gap-3 text-sm">
          {years.map((y) => (
            <li key={y}>
              <a href={`/api/reports/society-statement/${y}`} target="_blank" className="text-accent hover:underline">
                {y}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Annual general report</h2>
        <p className="text-sm text-neutral-500 mb-4">Income vs. expenditure (expenses + claim payouts) for a given year.</p>
        <ul className="flex flex-wrap gap-3 text-sm">
          {years.map((y) => (
            <li key={y}>
              <a href={`/api/reports/annual-general-report/${y}`} target="_blank" className="text-accent hover:underline">
                {y}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-medium mb-2 text-navy">Proof of payment ({total})</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Download a proof-of-payment receipt for any recorded payment.
        </p>

        <form className="flex gap-2 text-sm mb-4">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search member name or membership no"
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
                <th className="py-1 pr-3">Member</th>
                <th className="py-1 pr-3 hidden min-[480px]:table-cell">Category</th>
                <th className="py-1 pr-3 text-right">Amount</th>
                <th className="py-1 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3">{formatDate(p.paymentDate)}</td>
                  <td className="py-1 pr-3">
                    <Link href={`/admin/members/${p.memberId}/payments`} className="text-accent hover:underline">
                      {p.member.firstName} {p.member.surname}
                    </Link>
                  </td>
                  <td className="py-1 pr-3 hidden min-[480px]:table-cell">{p.category}</td>
                  <td className="py-1 pr-3 text-right">{formatCurrency(p.amount)}</td>
                  <td className="py-1 pr-3">
                    <a href={`/api/reports/proof-of-payment/${p.id}`} target="_blank" className="text-accent hover:underline">
                      Download
                    </a>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-neutral-500">No payments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} basePath="/admin/reports" params={{ search }} />
        </div>
      </Card>
    </div>
  );
}
