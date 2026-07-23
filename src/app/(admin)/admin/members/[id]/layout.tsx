import { getMemberDetail } from "@/server/actions/member";
import { getMemberContributionSummary } from "@/server/actions/payment";
import { MemberStatusBadge } from "@/components/ui/StatusBadge";
import { outstandingBalanceClass } from "@/lib/statusColors";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function MemberDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [member, summary] = await Promise.all([getMemberDetail(id), getMemberContributionSummary(id)]);
  if (!member) notFound();

  const tabs = [
    { href: `/admin/members/${id}`, label: "Maintenance" },
    { href: `/admin/members/${id}/payments`, label: "Payment History" },
    { href: `/admin/members/${id}/beneficiaries`, label: "Beneficiaries" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">{member.firstName} {member.surname}</h1>
        <p className="text-sm text-neutral-500 flex items-center gap-2 flex-wrap">
          <span>{member.membershipNo}</span>
          <MemberStatusBadge status={member.status} />
          <span>
            Outstanding: <span className={outstandingBalanceClass(summary.outstandingBalance)}>R {summary.outstandingBalance.toFixed(2)}</span>
          </span>
        </p>
      </div>

      <nav className="flex gap-4 border-b border-slate-200 text-sm">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="pb-2 text-neutral-600 hover:text-accent border-b-2 border-transparent hover:border-accent">
            {t.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
