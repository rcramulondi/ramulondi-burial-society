"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail, type EmailAttachment } from "@/lib/email";
import { generateProofOfPaymentPdf } from "@/lib/reports/proofOfPayment";
import { generateClaimPayoutProofPdf } from "@/lib/reports/claimPayoutProof";
import { fetchPrivateFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { RELATIONSHIP_LABELS } from "@/lib/statusLabels";
import { requireAuth } from "@/server/permissions";
import { DEFAULT_PAGE_SIZE, paginationSkip } from "@/lib/pagination";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

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

/**
 * Resolves everyone who should be emailed about a pending beneficiary
 * approval: every non-disabled admin account (User.email) plus every
 * current committee-term holder (read straight off Member.email — a
 * committee member need not have a User login at all for this purpose).
 * Deduped case-insensitively by email; a recipient with no email at all is
 * dropped (nothing to send to).
 */
async function resolveAdminAndCommitteeRecipients(): Promise<string[]> {
  const [admins, committeeTerms] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN", disabled: false }, select: { email: true } }),
    prisma.committeeTerm.findMany({ where: { endDate: null }, include: { member: true } }),
  ]);

  const emails = new Set<string>();
  for (const a of admins) {
    if (a.email) emails.add(a.email.toLowerCase());
  }
  for (const t of committeeTerms) {
    if (t.member.email) emails.add(t.member.email.toLowerCase());
  }
  return [...emails];
}

/**
 * Notifies every admin and committee member the moment a member submits a
 * new beneficiary, so a Secretary/Super Admin can review and approve it.
 * Never throws — a notification failure must not block the submission
 * itself (the request still exists and is reviewable in the approvals
 * inbox either way).
 */
export async function sendBeneficiaryApprovalRequestEmail(beneficiaryId: string, performedByUserId: string): Promise<void> {
  try {
    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({
      where: { id: beneficiaryId },
      include: { member: true },
    });

    const recipients = await resolveAdminAndCommitteeRecipients();
    const reviewLink = `${process.env.NEXTAUTH_URL ?? ""}/admin/beneficiary-approvals/${beneficiaryId}`;

    const results = await Promise.all(
      recipients.map(async (to) => {
        const result = await sendEmail({
          to,
          subject: `Beneficiary approval needed — ${beneficiary.firstName} ${beneficiary.surname}`,
          html: `
            <p>A member has submitted a new beneficiary that needs review and approval.</p>
            <h3>Member</h3>
            <ul>
              <li><strong>Name:</strong> ${beneficiary.member.firstName} ${beneficiary.member.surname}</li>
              <li><strong>Membership no:</strong> ${beneficiary.member.membershipNo}</li>
            </ul>
            <h3>Beneficiary</h3>
            <ul>
              <li><strong>Name:</strong> ${beneficiary.firstName} ${beneficiary.surname}</li>
              <li><strong>Relationship:</strong> ${RELATIONSHIP_LABELS[beneficiary.relationship]}</li>
              <li><strong>Reference number:</strong> ${beneficiary.referenceNo}</li>
            </ul>
            <p><strong>Submitted:</strong> ${beneficiary.createdAt.toLocaleString("en-ZA")}</p>
            <p><a href="${reviewLink}">Review this request</a></p>
            <p>The Secretary (or a Super Admin) must approve or reject it before it becomes active.</p>
            <p>Ramulondi Burial Society</p>
          `,
        });
        return { to, ok: result.ok };
      })
    );

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiaryId,
      memberId: beneficiary.memberId,
      action: "EMAIL_SENT",
      performedByUserId,
      metadata: { to: recipients, results },
    });
  } catch (e) {
    console.error(`[notifications] Failed to send beneficiary approval request email for beneficiary ${beneficiaryId}:`, e);
  }
}

/**
 * Tells the submitting member the outcome once a beneficiary request has
 * been decided — by email, and (when the member has their own login) as an
 * in-app Notification row. Covers both the normal approve/reject path and
 * the admin-bypass "added directly, now active" confirmation from the same
 * function, since both are just "here's what happened to your beneficiary."
 * Never throws.
 */
export async function sendBeneficiaryDecisionNotification(beneficiaryId: string, performedByUserId: string): Promise<void> {
  try {
    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({
      where: { id: beneficiaryId },
      include: { member: { include: { user: true } } },
    });

    const isApproved = beneficiary.status === "ACTIVE";
    const subject = isApproved
      ? `Beneficiary approved — ${beneficiary.firstName} ${beneficiary.surname}`
      : `Beneficiary request rejected — ${beneficiary.firstName} ${beneficiary.surname}`;
    const title = isApproved ? "Beneficiary approved" : "Beneficiary request rejected";
    const body = isApproved
      ? `${beneficiary.firstName} ${beneficiary.surname} has been approved and is now active on your policy.`
      : `${beneficiary.firstName} ${beneficiary.surname}'s addition was rejected. Reason: ${beneficiary.reviewNotes ?? "Not provided"}.`;

    let emailResult: { ok: boolean; error?: string } | undefined;
    if (beneficiary.member.email) {
      emailResult = await sendEmail({
        to: beneficiary.member.email,
        subject,
        html: `
          <p>Dear ${beneficiary.member.firstName},</p>
          <p>${body}</p>
          <p>Ramulondi Burial Society</p>
        `,
      });
    }

    if (beneficiary.member.user) {
      await prisma.notification.create({
        data: {
          userId: beneficiary.member.user.id,
          type: isApproved ? "BENEFICIARY_APPROVED" : "BENEFICIARY_REJECTED",
          title,
          body,
          entityType: "Beneficiary",
          entityId: beneficiary.id,
          linkPath: "/beneficiaries",
        },
      });
    }

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiaryId,
      memberId: beneficiary.memberId,
      action: "EMAIL_SENT",
      performedByUserId,
      metadata: { to: beneficiary.member.email, ok: emailResult?.ok, error: emailResult?.error },
    });
  } catch (e) {
    console.error(`[notifications] Failed to send beneficiary decision notification for beneficiary ${beneficiaryId}:`, e);
  }
}

// --- In-app notification read-side actions ---

const NOTIFICATIONS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export async function listMyNotifications(page?: number) {
  const session = await requireAuth();
  const p = Math.max(1, page ?? 1);
  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: paginationSkip(p, NOTIFICATIONS_PAGE_SIZE),
    take: NOTIFICATIONS_PAGE_SIZE,
  });
}

export async function countUnreadNotifications(): Promise<number> {
  const session = await requireAuth();
  return prisma.notification.count({ where: { userId: session.user.id, readAt: null } });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const session = await requireAuth();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markNotificationReadForm(formData: FormData): Promise<ActionResult<null>> {
  try {
    await markNotificationRead(String(formData.get("notificationId") ?? ""));
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to mark notification as read.") };
  }
}

export async function markAllNotificationsReadForm(): Promise<ActionResult<null>> {
  try {
    await markAllNotificationsRead();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to mark notifications as read.") };
  }
}
