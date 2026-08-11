"use server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { generateProofOfPaymentPdf } from "@/lib/reports/proofOfPayment";
import { logAudit } from "@/lib/audit";

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
