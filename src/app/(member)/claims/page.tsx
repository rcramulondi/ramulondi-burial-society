import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CLAIM_STATUS_LABELS } from "@/lib/statusLabels";
import { uploadDocument } from "@/server/actions/document";
import ActionForm from "@/components/forms/ActionForm";

export default async function ClaimsPage() {
  const session = await auth();
  const memberId = session!.user.memberId!;

  const [ownClaim, submittedByMe] = await Promise.all([
    prisma.claim.findUnique({ where: { memberId }, include: { payout: true, documents: true } }),
    prisma.claim.findMany({
      where: { submittedByUserId: session!.user.id, memberId: { not: memberId } },
      include: { member: true, payout: true, documents: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Claims</h1>
        <Link href="/claims/new" className="text-sm underline">
          File a new claim
        </Link>
      </div>

      {ownClaim && (
        <section>
          <h2 className="font-medium mb-2">Claim on my policy</h2>
          <ClaimCard claim={ownClaim} memberId={memberId} />
        </section>
      )}

      {submittedByMe.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">Claims I filed for family members</h2>
          <div className="flex flex-col gap-3">
            {submittedByMe.map((c) => (
              <div key={c.id}>
                <p className="text-sm text-neutral-500">{c.member.firstName} {c.member.surname}</p>
                <ClaimCard claim={c} memberId={c.memberId} />
              </div>
            ))}
          </div>
        </section>
      )}

      {!ownClaim && submittedByMe.length === 0 && (
        <p className="text-neutral-500 text-sm">No claims on file.</p>
      )}
    </div>
  );
}

function ClaimCard({
  claim,
  memberId,
}: {
  claim: {
    id: string;
    status: keyof typeof CLAIM_STATUS_LABELS;
    dateDeceased: Date;
    payout: { amount: unknown; paidDate: Date } | null;
    documents: { id: string; ownerType: string; fileName: string }[];
  };
  memberId: string;
}) {
  const deathCert = claim.documents.find((d) => d.ownerType === "DEATH_CERTIFICATE");

  return (
    <div className="border rounded p-3 text-sm flex flex-col gap-2">
      <p>Status: <span className="font-medium">{CLAIM_STATUS_LABELS[claim.status]}</span></p>
      <p className="text-neutral-500">Date deceased: {claim.dateDeceased.toDateString()}</p>
      {claim.payout && (
        <p className="text-neutral-500">
          Paid R{Number(claim.payout.amount).toFixed(2)} on {claim.payout.paidDate.toDateString()}
        </p>
      )}

      {deathCert ? (
        <p className="text-xs">
          Death certificate: <a href={`/api/documents/${deathCert.id}`} target="_blank" className="underline">{deathCert.fileName}</a>
        </p>
      ) : (
        <ActionForm action={uploadDocument} submitLabel="Upload death certificate" className="flex flex-col gap-2">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="claimId" value={claim.id} />
          <input type="hidden" name="ownerType" value="DEATH_CERTIFICATE" />
          <input name="file" type="file" accept=".jpg,.jpeg,.png,.pdf" required className="text-xs" />
        </ActionForm>
      )}
    </div>
  );
}
