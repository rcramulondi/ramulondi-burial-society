"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { generateProofOfPaymentPdf } from "@/lib/reports/proofOfPayment";
import { generateClaimPayoutProofPdf } from "@/lib/reports/claimPayoutProof";
import { fetchPrivateFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { RELATIONSHIP_LABELS } from "@/lib/statusLabels";

// Fixed committee mailbox — not a per-member address, so it's not stored in
// the DB anywhere; every claim notification goes here regardless of which
// admin/member filed the claim.
const COMMITTEE_EMAIL = "ramulondiburialsociety@gmail.com";

/**
 * Emails the member their proof of payment for the full amount just
 * captured (no per-month breakdown — see generateProofOfPaymentPdf's
 * includeBreakdown param). No-ops silently if the member has no email on
 * file; the existing download-based proof of payment already covers that
 * case. Never throws — callers (recordPayment, allocateUnallocatedFund) must
 * not have a payment recording fail because of an email delivery problem.
 */
export async function sendProofOfPaymentEmail(paymentId: string, performedByUserId: string): Promise<void> {
  try {
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { member: true },
    });

    if (!payment.member.email) return;

    const pdf = await generateProofOfPaymentPdf(paymentId, false);

    const result = await sendEmail({
      to: payment.member.email,
      subject: "Proof of payment — Ramulondi Burial Society",
      html: `
        <p>Dear ${payment.member.firstName},</p>
        <p>Thank you for your payment of <strong>R ${Number(payment.amount).toFixed(2)}</strong> received on ${payment.paymentDate.toDateString()}.</p>
        <p>Your proof of payment is attached to this email.</p>
        <p>Ramulondi Burial Society</p>
      `,
      attachments: [{ filename: `proof-of-payment-${payment.id}.pdf`, content: pdf }],
    });

    await logAudit({
      entityType: "Payment",
      entityId: paymentId,
      memberId: payment.memberId,
      action: "EMAIL_SENT",
      performedByUserId,
      metadata: { to: payment.member.email, ok: result.ok, error: result.error },
    });
  } catch (e) {
    console.error(`[notifications] Failed to send proof-of-payment email for payment ${paymentId}:`, e);
  }
}

/**
 * Notifies the committee mailbox the moment a claim is filed, with every
 * detail they need to start reviewing it: the deceased (member or
 * beneficiary, with their reference number and relationship to the member),
 * the claimant's contact and banking details, and the burial location. The
 * death certificate is attached when one was uploaded with the claim. Never
 * throws — a notification failure must not block the claim submission
 * itself (the claim still exists and is reviewable in the admin portal
 * either way).
 */
export async function sendClaimNotificationEmail(claimId: string, performedByUserId: string): Promise<void> {
  try {
    const claim = await prisma.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: { member: true, beneficiary: true, documents: true },
    });

    const deceasedName = claim.beneficiary
      ? `${claim.beneficiary.firstName} ${claim.beneficiary.surname}`
      : `${claim.member.firstName} ${claim.member.surname}`;
    const deceasedReference = claim.beneficiary ? claim.beneficiary.referenceNo : claim.member.membershipNo;
    const relationship = claim.beneficiary ? RELATIONSHIP_LABELS[claim.beneficiary.relationship] : "Member (policyholder)";
    const burialLocation = claim.placeOfBurial === "KHALAVHA" ? "Khalavha" : "Community site (other)";

    const attachments: EmailAttachment[] = [];
    const deathCert = claim.documents.find((d) => d.ownerType === "DEATH_CERTIFICATE");
    if (deathCert) {
      const upstream = await fetchPrivateFile(deathCert.storageKey);
      if (upstream.ok && upstream.body) {
        const content = Buffer.from(await new Response(upstream.body).arrayBuffer());
        attachments.push({ filename: deathCert.fileName, content });
      }
    }

    const result = await sendEmail({
      to: COMMITTEE_EMAIL,
      subject: `New claim filed — ${deceasedName} (${claim.member.membershipNo})`,
      html: `
        <p>A new claim has been filed and requires review.</p>
        <h3>Deceased</h3>
        <ul>
          <li><strong>Name:</strong> ${deceasedName}</li>
          <li><strong>Reference number:</strong> ${deceasedReference}</li>
          <li><strong>Relationship to member:</strong> ${relationship}</li>
          <li><strong>Member:</strong> ${claim.member.firstName} ${claim.member.surname} (${claim.member.membershipNo})</li>
          <li><strong>Date deceased:</strong> ${claim.dateDeceased.toDateString()}</li>
          <li><strong>Place of burial:</strong> ${burialLocation}</li>
        </ul>
        <h3>Claimant</h3>
        <ul>
          <li><strong>Name:</strong> ${claim.payoutRecipientName} ${claim.payoutRecipientSurname}</li>
          <li><strong>ID number:</strong> ${claim.payoutRecipientIdNumber}</li>
          <li><strong>Phone:</strong> ${claim.payoutRecipientPhone}</li>
          <li><strong>Email:</strong> ${claim.payoutRecipientEmail ?? "Not provided"}</li>
        </ul>
        <h3>Banking details</h3>
        <ul>
          <li><strong>Bank:</strong> ${claim.bankName}</li>
          <li><strong>Account number:</strong> ${claim.bankAccountNumber}</li>
        </ul>
        <p>${deathCert ? "The death certificate is attached." : "No death certificate is attached — it had not yet been uploaded at the time of filing."}</p>
        <p>Review this claim in the admin portal to approve/reject and determine the payout.</p>
        <p>Ramulondi Burial Society</p>
      `,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    await logAudit({
      entityType: "Claim",
      entityId: claimId,
      memberId: claim.memberId,
      action: "EMAIL_SENT",
      performedByUserId,
      metadata: { to: COMMITTEE_EMAIL, ok: result.ok, error: result.error },
    });
  } catch (e) {
    console.error(`[notifications] Failed to send claim notification email for claim ${claimId}:`, e);
  }
}

/**
 * Emails the claimant their claim payout proof of payment once a payout is
 * recorded. `claimPayoutSchema` requires an email at payout time (unlike
 * claim submission, where it's optional), so this should always have a
 * recipient in normal operation — the no-op guard is defensive only. Never
 * throws, matching sendProofOfPaymentEmail's contract.
 */
export async function sendClaimPayoutProofEmail(claimId: string, performedByUserId: string): Promise<void> {
  try {
    const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
    if (!claim.payoutRecipientEmail) return;

    const pdf = await generateClaimPayoutProofPdf(claimId);

    const result = await sendEmail({
      to: claim.payoutRecipientEmail,
      subject: "Proof of payment — claim payout — Ramulondi Burial Society",
      html: `
        <p>Dear ${claim.payoutRecipientName},</p>
        <p>Your claim payout has been processed. Proof of payment is attached to this email, and remains available for reprint at any time on request.</p>
        <p>Ramulondi Burial Society</p>
      `,
      attachments: [{ filename: `claim-payout-proof-${claimId}.pdf`, content: pdf }],
    });

    await logAudit({
      entityType: "Claim",
      entityId: claimId,
      memberId: claim.memberId,
      action: "EMAIL_SENT",
      performedByUserId,
      metadata: { to: claim.payoutRecipientEmail, ok: result.ok, error: result.error },
    });
  } catch (e) {
    console.error(`[notifications] Failed to send claim payout proof email for claim ${claimId}:`, e);
  }
}
