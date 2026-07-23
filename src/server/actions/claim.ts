"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth, requireOwnMemberOrAdmin } from "@/server/permissions";
import { claimCreateSchema, claimPayoutSchema } from "@/lib/validation/schemas";
import { checkClaimSubmissionEligibility, assertPayoutAllowed, computeClaimPayoutAmount } from "@/lib/business/claimEligibility";
import { getOutstandingBalance } from "@/lib/business/contributionAllocation";
import { refreshMemberStatus } from "@/lib/business/memberStatus";
import { applyBeneficiaryStatusTransition } from "./beneficiary";
import { uploadPrivateFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

/**
 * A death certificate is required to file a claim — accepted in the SAME
 * submission as the claim itself (not a separate follow-up upload step,
 * mirroring Expense's compulsory-receipt precedent) so a Claim can never
 * exist without one attached.
 */
export async function submitClaim(input: unknown, deathCertificateFile?: File): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = claimCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    if (!(deathCertificateFile instanceof File) || deathCertificateFile.size === 0) {
      return { ok: false, error: "A death certificate is required to file a claim." };
    }

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

    const uploaded = await uploadPrivateFile(deathCertificateFile, "claims");

    const claim = await prisma.$transaction(async (tx) => {
      const c = await tx.claim.create({
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
      await tx.document.create({
        data: {
          ownerType: "DEATH_CERTIFICATE",
          memberId: data.memberId,
          beneficiaryId: data.beneficiaryId,
          claimId: c.id,
          storageKey: uploaded.storageKey,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          uploadedByUserId: session.user.id,
        },
      });
      return c;
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

/**
 * `year` filters by payout year (`ClaimPayout.paidDate`) — a claim only has
 * a concrete Rand value once paid, so that's the year it counts toward for
 * reporting purposes, not the year it was filed.
 */
export async function listClaims(query?: { status?: string; year?: number }) {
  await requireAdmin();
  return prisma.claim.findMany({
    where: {
      ...(query?.status ? { status: query.status as never } : {}),
      ...(query?.year
        ? {
            payout: {
              paidDate: {
                gte: new Date(Date.UTC(query.year, 0, 1)),
                lt: new Date(Date.UTC(query.year + 1, 0, 1)),
              },
            },
          }
        : {}),
    },
    include: { member: true, beneficiary: true, payout: true },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getClaimOutstandingBalance(memberId: string) {
  await requireAdmin();
  return getOutstandingBalance(memberId);
}

/**
 * Payouts applicable to this member — claims against the member themselves
 * OR against any of their own beneficiaries (a policy pays out regardless of
 * which of the two died).
 */
export async function getMemberPayoutSummary(memberId: string) {
  await requireOwnMemberOrAdmin(memberId);
  const beneficiaryIds = (await prisma.beneficiary.findMany({ where: { memberId }, select: { id: true } })).map((b) => b.id);

  const payouts = await prisma.claimPayout.findMany({
    where: { claim: { OR: [{ memberId }, { beneficiaryId: { in: beneficiaryIds } }] } },
    include: { claim: { include: { beneficiary: true } } },
    orderBy: { paidDate: "desc" },
  });

  return {
    count: payouts.length,
    total: Math.round(payouts.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100,
    payouts,
  };
}

// --- FormData wrappers, for direct use with <ActionForm> ---

/**
 * `memberId`/`beneficiaryId` are posted directly by the SearchSelect pickers
 * on the filing form (no more free-text membershipNo/referenceNo lookup) —
 * this is now a thin passthrough plus death-certificate file handling.
 */
export async function submitClaimForm(formData: FormData) {
  const obj = formDataToObject(formData);
  if (!obj.beneficiaryId) delete obj.beneficiaryId;
  const file = formData.get("deathCertificate");
  return submitClaim(obj, file instanceof File ? file : undefined);
}

export async function reviewClaimForm(formData: FormData) {
  return reviewClaim(formDataToObject(formData));
}

export async function recordClaimPayoutForm(formData: FormData) {
  return recordClaimPayout(formDataToObject(formData));
}
