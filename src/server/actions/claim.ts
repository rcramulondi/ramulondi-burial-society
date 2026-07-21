"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/server/permissions";
import { claimCreateSchema, claimPayoutSchema } from "@/lib/validation/schemas";
import { checkClaimSubmissionEligibility, assertPayoutAllowed, computeClaimPayoutAmount } from "@/lib/business/claimEligibility";
import { getOutstandingBalance } from "@/lib/business/contributionAllocation";
import { refreshMemberStatus } from "@/lib/business/memberStatus";
import { applyBeneficiaryStatusTransition } from "./beneficiary";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

export async function submitClaim(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = claimCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;
    // Claims are filed by a surviving family member on behalf of the deceased
    // (member or one of their beneficiaries) — any authenticated member (or
    // admin) may submit. Unlike a member's own status, submission does NOT
    // require the member/beneficiary to already be marked deceased —
    // approval is what does that (see reviewClaim below). Eligibility below
    // covers cooling-off, no duplicate claim, and not already lapsed at
    // death. Admin review before payout is the real authorization gate, not
    // who happens to click submit.
    const session = await requireAuth();

    const eligibility = await checkClaimSubmissionEligibility(data.memberId, {
      dateDeceased: data.dateDeceased,
      beneficiaryId: data.beneficiaryId ?? null,
    });
    if (!eligibility.eligible) {
      return { ok: false, error: eligibility.reason };
    }

    const claim = await prisma.claim.create({
      data: {
        memberId: data.memberId,
        beneficiaryId: data.beneficiaryId,
        dateDeceased: data.dateDeceased,
        placeOfBurial: data.placeOfBurial,
        payoutRecipientName: data.payoutRecipientName,
        payoutRecipientSurname: data.payoutRecipientSurname,
        payoutRecipientIdNumber: data.payoutRecipientIdNumber,
        payoutRecipientPhone: data.payoutRecipientPhone,
        payoutRecipientEmail: data.payoutRecipientEmail,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        submittedByUserId: session.user.id,
      },
    });

    await logAudit({
      entityType: "Claim",
      entityId: claim.id,
      memberId: data.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
    });

    revalidatePath("/claims");
    revalidatePath("/admin/claims");
    return { ok: true, data: { id: claim.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to submit claim.") };
  }
}

const reviewSchema = z.object({
  claimId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().trim().optional(),
});

export async function reviewClaim(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const claim = await prisma.$transaction(async (tx) => {
      const updated = await tx.claim.update({
        where: { id: data.claimId },
        data: {
          status: data.decision,
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: data.reviewNotes,
        },
      });

      // Approval is what marks the member/beneficiary deceased — not claim
      // submission (which no longer requires it to already be set).
      if (data.decision === "APPROVED") {
        if (updated.beneficiaryId) {
          const result = await applyBeneficiaryStatusTransition(
            updated.beneficiaryId,
            "DECEASED",
            session.user.id,
            tx
          );
          if (!result.ok) throw new Error(result.error);
        } else {
          await tx.member.update({
            where: { id: updated.memberId },
            data: { deceasedDate: updated.dateDeceased },
          });
        }
      }

      return updated;
    });

    // refreshMemberStatus does its own DB round trips and isn't
    // $transaction-aware, so it runs just after the transaction commits.
    if (data.decision === "APPROVED" && !claim.beneficiaryId) {
      await refreshMemberStatus(claim.memberId);
    }

    await logAudit({
      entityType: "Claim",
      entityId: claim.id,
      memberId: claim.memberId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { decision: data.decision },
    });

    revalidatePath("/admin/claims");
    revalidatePath("/claims");
    return { ok: true, data: { id: claim.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to review claim.") };
  }
}

export async function recordClaimPayout(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = claimPayoutSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const claim = await prisma.claim.findUniqueOrThrow({ where: { id: data.claimId } });
    if (claim.status !== "APPROVED") {
      return { ok: false, error: "Only approved claims can be paid out." };
    }

    await assertPayoutAllowed(claim.memberId);

    const amount = await computeClaimPayoutAmount(claim, claim.reviewedAt ?? new Date());

    const payout = await prisma.$transaction(async (tx) => {
      const p = await tx.claimPayout.create({
        data: {
          claimId: data.claimId,
          amount,
          paidDate: data.paidDate,
          paidTo: data.paidTo,
          notes: data.notes,
          paidByUserId: session.user.id,
        },
      });
      await tx.claim.update({ where: { id: data.claimId }, data: { status: "PAID" } });
      return p;
    });

    await logAudit({
      entityType: "ClaimPayout",
      entityId: payout.id,
      memberId: claim.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { amount, paidTo: data.paidTo },
    });

    revalidatePath("/admin/claims");
    return { ok: true, data: { id: payout.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to record payout.") };
  }
}

export async function listClaims(status?: string) {
  await requireAdmin();
  return prisma.claim.findMany({
    where: status ? { status: status as never } : {},
    include: { member: true, beneficiary: true, payout: true },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getClaimOutstandingBalance(memberId: string) {
  await requireAdmin();
  return getOutstandingBalance(memberId);
}

// --- FormData wrappers, for direct use with <ActionForm> ---

/**
 * Resolves the deceased member by membership number (a lookup, not free
 * text) before submitting. If a beneficiary reference number is also given,
 * resolves and validates that it belongs to the same member — leave it
 * blank when the deceased is the member themselves.
 */
export async function submitClaimForm(formData: FormData) {
  const membershipNo = String(formData.get("membershipNo") ?? "").trim();
  const member = await prisma.member.findUnique({ where: { membershipNo } });
  if (!member) return { ok: false as const, error: `No member found with membership number "${membershipNo}".` };

  const obj = formDataToObject(formData);
  obj.memberId = member.id;
  delete obj.membershipNo;

  const beneficiaryReferenceNo = String(obj.beneficiaryReferenceNo ?? "").trim();
  delete obj.beneficiaryReferenceNo;
  if (beneficiaryReferenceNo) {
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { referenceNo: beneficiaryReferenceNo, memberId: member.id },
    });
    if (!beneficiary) {
      return { ok: false as const, error: `No beneficiary found with reference number "${beneficiaryReferenceNo}" for this member.` };
    }
    obj.beneficiaryId = beneficiary.id;
  }

  return submitClaim(obj);
}

export async function reviewClaimForm(formData: FormData) {
  return reviewClaim(formDataToObject(formData));
}

export async function recordClaimPayoutForm(formData: FormData) {
  return recordClaimPayout(formDataToObject(formData));
}
