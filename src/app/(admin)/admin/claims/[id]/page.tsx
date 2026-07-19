import { prisma } from "@/lib/prisma";
import { getClaimOutstandingBalance, reviewClaimForm, recordClaimPayoutForm } from "@/server/actions/claim";
import ActionForm from "@/components/forms/ActionForm";
import Field from "@/components/forms/Field";
import { CLAIM_STATUS_LABELS } from "@/lib/statusLabels";
import { notFound } from "next/navigation";

export default async function AdminClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: { member: true, payout: true, documents: true },
  });
  if (!claim) notFound();

  const outstanding = await getClaimOutstandingBalance(claim.memberId);
  const deathCert = claim.documents.find((d) => d.ownerType === "DEATH_CERTIFICATE");

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">
          Claim for {claim.member.firstName} {claim.member.surname}
        </h1>
        <p className="text-sm text-neutral-500">
          {claim.member.membershipNo} &middot; Status: {CLAIM_STATUS_LABELS[claim.status]}
        </p>
      </div>

      <dl className="text-sm grid grid-cols-2 gap-y-1">
        <dt className="text-neutral-500">Date deceased</dt>
        <dd>{claim.dateDeceased.toDateString()}</dd>
        <dt className="text-neutral-500">Payout recipient</dt>
        <dd>{claim.payoutRecipientName} {claim.payoutRecipientSurname}</dd>
        <dt className="text-neutral-500">Recipient ID</dt>
        <dd>{claim.payoutRecipientIdNumber}</dd>
        <dt className="text-neutral-500">Recipient phone</dt>
        <dd>{claim.payoutRecipientPhone}</dd>
        <dt className="text-neutral-500">Bank</dt>
        <dd>{claim.bankName} &middot; {claim.bankAccountNumber}</dd>
        <dt className="text-neutral-500">Outstanding balance</dt>
        <dd className={outstanding > 0 ? "text-red-700 dark:text-red-400 font-medium" : ""}>
          R {outstanding.toFixed(2)}
        </dd>
      </dl>

      <div>
        <h2 className="font-medium mb-1">Death certificate</h2>
        {deathCert ? (
          <a href={`/api/documents/${deathCert.id}`} target="_blank" className="underline text-sm">{deathCert.fileName}</a>
        ) : (
          <p className="text-sm text-neutral-500">Not yet uploaded by the claimant.</p>
        )}
      </div>

      {claim.status === "PENDING" && (
        <section>
          <h2 className="font-medium mb-2">Review</h2>
          <div className="flex gap-4">
            <ActionForm action={reviewClaimForm} submitLabel="Approve" className="flex flex-col gap-2">
              <input type="hidden" name="claimId" value={claim.id} />
              <input type="hidden" name="decision" value="APPROVED" />
            </ActionForm>
            <ActionForm action={reviewClaimForm} submitLabel="Reject" className="flex flex-col gap-2">
              <input type="hidden" name="claimId" value={claim.id} />
              <input type="hidden" name="decision" value="REJECTED" />
            </ActionForm>
          </div>
        </section>
      )}

      {claim.status === "APPROVED" && !claim.payout && (
        <section>
          <h2 className="font-medium mb-2">Record payout</h2>
          {outstanding > 0 && (
            <p className="text-sm text-red-700 dark:text-red-400 mb-2">
              Payout is blocked while an outstanding balance remains — settle it first.
            </p>
          )}
          <ActionForm action={recordClaimPayoutForm} submitLabel="Record payout">
            <input type="hidden" name="claimId" value={claim.id} />
            <Field label="Amount paid (R)" name="amount" type="number" required />
            <Field label="Paid date" name="paidDate" type="date" required />
            <Field label="Paid to" name="paidTo" defaultValue={`${claim.payoutRecipientName} ${claim.payoutRecipientSurname}`} required />
            <Field label="Notes (optional)" name="notes" />
          </ActionForm>
        </section>
      )}

      {claim.payout && (
        <section>
          <h2 className="font-medium mb-2">Payout recorded</h2>
          <p className="text-sm">
            R {Number(claim.payout.amount).toFixed(2)} paid to {claim.payout.paidTo} on {claim.payout.paidDate.toDateString()}
          </p>
        </section>
      )}
    </div>
  );
}
