import type { MemberStatus, BeneficiaryStatus } from "@prisma/client";
import { STATUS_LABELS, BENEFICIARY_STATUS_LABELS } from "@/lib/statusLabels";
import { MEMBER_STATUS_COLORS, BENEFICIARY_STATUS_COLORS, STATUS_COLOR_CLASSES } from "@/lib/statusColors";

function Badge({ label, colorClasses }: { label: string; colorClasses: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${colorClasses}`}>
      {label}
    </span>
  );
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return <Badge label={STATUS_LABELS[status]} colorClasses={STATUS_COLOR_CLASSES[MEMBER_STATUS_COLORS[status]]} />;
}

export function BeneficiaryStatusBadge({ status }: { status: BeneficiaryStatus }) {
  return <Badge label={BENEFICIARY_STATUS_LABELS[status]} colorClasses={STATUS_COLOR_CLASSES[BENEFICIARY_STATUS_COLORS[status]]} />;
}
