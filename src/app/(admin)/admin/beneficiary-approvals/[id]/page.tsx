import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewBeneficiaryForm } from "@/server/actions/beneficiary";
import { RELATIONSHIP_LABELS } from "@/lib/statusLabels";
import { BeneficiaryStatusBadge } from "@/components/ui/StatusBadge";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { formatDate, formatDateTime } from "@/lib/format";
import { notFound } from "next/navigation";

export default async function AdminBeneficiaryApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, beneficiary] = await Promise.all([
    auth(),
    prisma.beneficiary.findUnique({ where: { id }, include: { member: true } }),
  ]);
  if (!beneficiary) notFound();

  const canDecide = session?.user.adminGroup === "SUPER_ADMIN" || session?.user.adminGroup === "SECRETARY";

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">
          Beneficiary request — {beneficiary.firstName} {beneficiary.surname}
        </h1>
        <p className="text-sm text-neutral-500 flex items-center gap-2 mt-1">
          <span>For {beneficiary.member.firstName} {beneficiary.member.surname} ({beneficiary.member.membershipNo})</span>
          <BeneficiaryStatusBadge status={beneficiary.status} />
        </p>
      </div>

      <dl className="text-sm grid grid-cols-2 gap-y-1">
        <dt className="text-neutral-500">Relationship</dt>
        <dd>{RELATIONSHIP_LABELS[beneficiary.relationship]}</dd>
        <dt className="text-neutral-500">Reference number</dt>
        <dd>{beneficiary.referenceNo}</dd>
        <dt className="text-neutral-500">ID number</dt>
        <dd>{beneficiary.idNumber ?? "—"}</dd>
        <dt className="text-neutral-500">Phone</dt>
        <dd>{beneficiary.phone ?? "—"}</dd>
        <dt className="text-neutral-500">Email</dt>
        <dd>{beneficiary.email ?? "—"}</dd>
        <dt className="text-neutral-500">Date of birth</dt>
        <dd>{formatDate(beneficiary.dateOfBirth)}</dd>
        <dt className="text-neutral-500">Disability</dt>
        <dd>{beneficiary.isDisabled ? "Yes" : "No"}</dd>
        <dt className="text-neutral-500">Submitted</dt>
        <dd>{formatDateTime(beneficiary.createdAt)}</dd>
      </dl>

      {beneficiary.status === "REJECTED" && beneficiary.reviewNotes && (
        <div>
          <h2 className="font-medium mb-1">Rejection reason</h2>
          <p className="text-sm text-danger">{beneficiary.reviewNotes}</p>
        </div>
      )}

      {beneficiary.status === "PENDING_APPROVAL" && canDecide && (
        <section>
          <h2 className="font-medium mb-2">Review</h2>
          <p className="text-xs text-neutral-500 mb-2">
            Approving activates this beneficiary immediately. Rejecting requires a reason, which the
            member will see.
          </p>
          <div className="flex flex-col gap-4">
            <ActionForm action={reviewBeneficiaryForm} submitLabel="Approve" className="flex flex-col gap-2">
              <input type="hidden" name="beneficiaryId" value={beneficiary.id} />
              <input type="hidden" name="decision" value="APPROVED" />
            </ActionForm>
            <ActionForm action={reviewBeneficiaryForm} submitLabel="Reject" className="flex flex-col gap-2 max-w-sm">
              <input type="hidden" name="beneficiaryId" value={beneficiary.id} />
              <input type="hidden" name="decision" value="REJECTED" />
              <Field label="Reason for rejection" name="reviewNotes" required helperText="The member will see this." />
            </ActionForm>
          </div>
        </section>
      )}

      {beneficiary.status === "PENDING_APPROVAL" && !canDecide && (
        <p className="text-sm text-neutral-500">
          Only the Secretary or a Super Admin can approve or reject this request.
        </p>
      )}
    </div>
  );
}
