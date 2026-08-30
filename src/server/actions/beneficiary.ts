"use server";

import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin, requireMemberMaintainer, requireAdminGroup, requireAdmin } from "@/server/permissions";
import { beneficiaryCreateSchema, beneficiaryUpdateSchema } from "@/lib/validation/schemas";
import { generateBeneficiaryReference } from "@/lib/business/membershipNumber";
import {
  assertSingleParentSlotAvailable,
  assertDeletionAllowed,
  assertNotReRegisteringDeceased,
} from "@/lib/business/beneficiaryRules";
import { sendBeneficiaryApprovalRequestEmail, sendBeneficiaryDecisionNotification } from "./notifications";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import { DEFAULT_PAGE_SIZE, paginationSkip } from "@/lib/pagination";
import { z } from "zod";
import type { BeneficiaryStatus, Prisma } from "@prisma/client";
import type { ActionResult } from "./member";

/**
 * A member-submitted beneficiary starts PENDING_APPROVAL and isn't eligible
 * for claims until a Secretary/Super Admin reviews it (see reviewBeneficiary
 * below). Only SUPER_ADMIN/SECRETARY can reach this action at all when
 * acting on someone else's behalf (per requireMemberMaintainer) — so "added
 * by an Administrator" bypasses the workflow entirely and activates
 * immediately, since that admin already holds the same authority that would
 * have approved it anyway.
 */
export async function createBeneficiary(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = beneficiaryCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;
    const session = await requireMemberMaintainer(data.memberId);

    const member = await prisma.member.findUniqueOrThrow({ where: { id: data.memberId } });
    if (member.status === "DECEASED") {
      return { ok: false, error: "This member is recorded as deceased — no new beneficiaries can be added." };
    }

    if (data.relationship === "FATHER" || data.relationship === "MOTHER") {
      await assertSingleParentSlotAvailable(data.memberId, data.relationship);
    }
    await assertNotReRegisteringDeceased(data.idNumber);

    const referenceNo = await generateBeneficiaryReference(member.membershipNo, member.id);
    const isAdminSubmission = session.user.role === "ADMIN";

    const beneficiary = await prisma.beneficiary.create({
      data: {
        memberId: data.memberId,
        firstName: data.firstName,
        surname: data.surname,
        idNumber: data.idNumber,
        phone: data.phone,
        email: data.email,
        relationship: data.relationship,
        dateOfBirth: data.dateOfBirth,
        isDisabled: data.isDisabled,
        referenceNo,
        status: isAdminSubmission ? "ACTIVE" : "PENDING_APPROVAL",
        submittedByUserId: session.user.id,
        ...(isAdminSubmission
          ? {
              reviewedByUserId: session.user.id,
              reviewedAt: new Date(),
              reviewNotes: "Auto-approved — added directly by an Administrator.",
            }
          : {}),
      },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiary.id,
      memberId: data.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
    });

    if (isAdminSubmission) {
      await sendBeneficiaryDecisionNotification(beneficiary.id, session.user.id);
    } else {
      await sendBeneficiaryApprovalRequestEmail(beneficiary.id, session.user.id);
    }

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${data.memberId}`);
    revalidatePath(`/admin/members/${data.memberId}/beneficiaries`);
    revalidatePath("/admin/beneficiary-approvals");
    return { ok: true, data: { id: beneficiary.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to add beneficiary.") };
  }
}

/**
 * General field edits (name, ID, contact details, relationship, DOB,
 * disability flag) — distinct from `updateBeneficiaryStatus`, which owns the
 * ACTIVE/INACTIVE/DECEASED transition exclusively. `referenceNo` and
 * `status` are never editable here.
 */
export async function updateBeneficiary(beneficiaryId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = beneficiaryUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const existing = await prisma.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } });
    const session = await requireMemberMaintainer(existing.memberId);

    if (existing.status === "DECEASED") {
      return { ok: false, error: "This beneficiary is recorded as deceased and can no longer be edited." };
    }
    if (existing.status === "REJECTED") {
      return { ok: false, error: "This beneficiary's addition was rejected and can no longer be edited." };
    }

    if (data.relationship === "FATHER" || data.relationship === "MOTHER") {
      await assertSingleParentSlotAvailable(existing.memberId, data.relationship, beneficiaryId);
    }
    if (data.idNumber && data.idNumber !== existing.idNumber) {
      await assertNotReRegisteringDeceased(data.idNumber);
    }

    const beneficiary = await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: {
        firstName: data.firstName,
        surname: data.surname,
        idNumber: data.idNumber,
        phone: data.phone,
        email: data.email,
        relationship: data.relationship,
        dateOfBirth: data.dateOfBirth,
        isDisabled: data.isDisabled,
      },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiary.id,
      memberId: existing.memberId,
      action: "UPDATE",
      performedByUserId: session.user.id,
    });

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${existing.memberId}/beneficiaries`);
    return { ok: true, data: { id: beneficiary.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to update beneficiary.") };
  }
}

export async function deleteBeneficiary(beneficiaryId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } });
    const session = await requireMemberMaintainer(beneficiary.memberId);

    if (beneficiary.status === "PENDING_APPROVAL" || beneficiary.status === "REJECTED") {
      return { ok: false, error: "Use Cancel to withdraw a beneficiary that hasn't been approved yet." };
    }

    await assertDeletionAllowed(beneficiary.memberId);

    await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiaryId,
      memberId: beneficiary.memberId,
      action: "DELETE",
      performedByUserId: session.user.id,
    });

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${beneficiary.memberId}`);
    return { ok: true, data: { id: beneficiaryId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to delete beneficiary.") };
  }
}

/**
 * Member self-service withdrawal of a request that never went active — a
 * PENDING_APPROVAL beneficiary the member no longer wants considered, or a
 * REJECTED one they want off their record (dismissing it also frees up a
 * held Father/Mother slot, since the single-parent unique index only checks
 * deletedAt, not status). Logs STATUS_CHANGE rather than DELETE so this
 * never consumes assertDeletionAllowed's real once-per-12-months allowance,
 * which is meant to throttle removing a beneficiary that was actually active.
 */
export async function cancelBeneficiary(beneficiaryId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } });
    const session = await requireMemberMaintainer(beneficiary.memberId);

    if (beneficiary.status !== "PENDING_APPROVAL" && beneficiary.status !== "REJECTED") {
      return { ok: false, error: "Only a pending or rejected beneficiary request can be cancelled." };
    }

    await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiaryId,
      memberId: beneficiary.memberId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { cancelledFromStatus: beneficiary.status },
    });

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${beneficiary.memberId}`);
    revalidatePath(`/admin/members/${beneficiary.memberId}/beneficiaries`);
    revalidatePath("/admin/beneficiary-approvals");
    return { ok: true, data: { id: beneficiaryId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to cancel beneficiary request.") };
  }
}

export async function listBeneficiaries(memberId: string) {
  await requireOwnMemberOrAdmin(memberId);
  return prisma.beneficiary.findMany({
    where: { memberId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Shared status-transition body (DB update + audit log), used both by the
 * admin-facing `updateBeneficiaryStatus` action below and by claim approval
 * (src/server/actions/claim.ts) when the deceased party is a beneficiary
 * rather than the member themselves — avoids duplicating the audit-metadata
 * shape and the "DECEASED is terminal" guard in two places. Accepts an
 * optional transaction client so callers already inside a `$transaction`
 * (like claim approval) can include this write atomically.
 */
export async function applyBeneficiaryStatusTransition(
  beneficiaryId: string,
  status: BeneficiaryStatus,
  performedByUserId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ ok: true } | { ok: false; error: string }> {
  const beneficiary = await client.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } });

  if (beneficiary.status === "DECEASED") {
    return { ok: false, error: "This beneficiary is recorded as deceased and cannot be changed further." };
  }
  if (beneficiary.status === "PENDING_APPROVAL") {
    return { ok: false, error: "This beneficiary is awaiting approval — use the Pending Beneficiary Approvals inbox to approve or reject it." };
  }
  if (status === "PENDING_APPROVAL" || status === "REJECTED") {
    return { ok: false, error: "This status can only be set through the beneficiary approval workflow." };
  }

  await client.beneficiary.update({ where: { id: beneficiaryId }, data: { status } });

  await logAudit({
    entityType: "Beneficiary",
    entityId: beneficiaryId,
    memberId: beneficiary.memberId,
    action: "STATUS_CHANGE",
    performedByUserId,
    metadata: { from: beneficiary.status, to: status },
  });

  return { ok: true };
}

/**
 * Admin-only status transitions (Active/Inactive/Deceased tracking is an
 * admin capability, unlike create/delete which members can also do on their
 * own record). DECEASED is terminal — no further transitions once set.
 */
export async function updateBeneficiaryStatus(
  beneficiaryId: string,
  status: BeneficiaryStatus
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "SECRETARY");
    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } });

    const result = await applyBeneficiaryStatusTransition(beneficiaryId, status, session.user.id);
    if (!result.ok) return result;

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${beneficiary.memberId}/beneficiaries`);
    return { ok: true, data: { id: beneficiaryId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to update beneficiary status.") };
  }
}

const reviewBeneficiarySchema = z
  .object({
    beneficiaryId: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reviewNotes: z.string().trim().optional(),
  })
  .refine((d) => d.decision !== "REJECTED" || !!d.reviewNotes, {
    message: "A reason is required when rejecting a beneficiary.",
    path: ["reviewNotes"],
  });

/**
 * The decisive approve/reject action for a member-submitted beneficiary —
 * gated identically to reviewClaim (Secretary or Super Admin only). Other
 * admins can view the pending request but only these two groups can act on
 * it. A single, one-shot decision (no multi-reviewer chain).
 */
export async function reviewBeneficiary(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "SECRETARY");
    const parsed = reviewBeneficiarySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({ where: { id: data.beneficiaryId } });
    if (beneficiary.status !== "PENDING_APPROVAL") {
      return { ok: false, error: "This beneficiary is not awaiting approval." };
    }

    const updated = await prisma.beneficiary.update({
      where: { id: data.beneficiaryId },
      data: {
        status: data.decision === "APPROVED" ? "ACTIVE" : "REJECTED",
        reviewedByUserId: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes,
      },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: updated.id,
      memberId: updated.memberId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { decision: data.decision, reviewNotes: data.reviewNotes },
    });

    await sendBeneficiaryDecisionNotification(updated.id, session.user.id);

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${updated.memberId}`);
    revalidatePath(`/admin/members/${updated.memberId}/beneficiaries`);
    revalidatePath("/admin/beneficiary-approvals");
    return { ok: true, data: { id: updated.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to review beneficiary.") };
  }
}

const BENEFICIARY_APPROVALS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

function pendingBeneficiaryApprovalsWhere(query?: { search?: string }) {
  return {
    status: "PENDING_APPROVAL" as const,
    deletedAt: null,
    ...(query?.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" as const } },
            { surname: { contains: query.search, mode: "insensitive" as const } },
            { member: { firstName: { contains: query.search, mode: "insensitive" as const } } },
            { member: { surname: { contains: query.search, mode: "insensitive" as const } } },
            { member: { membershipNo: { contains: query.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

/**
 * The Pending Beneficiary Approvals inbox — viewable by any admin group
 * (the decisive action itself is separately gated inside reviewBeneficiary).
 * Always scoped to PENDING_APPROVAL, so a reviewed request automatically
 * disappears from this list the moment it's approved or rejected.
 */
export async function listPendingBeneficiaryApprovals(query?: { search?: string; page?: number }) {
  await requireAdmin();
  const page = Math.max(1, query?.page ?? 1);
  return prisma.beneficiary.findMany({
    where: pendingBeneficiaryApprovalsWhere(query),
    include: { member: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: paginationSkip(page, BENEFICIARY_APPROVALS_PAGE_SIZE),
    take: BENEFICIARY_APPROVALS_PAGE_SIZE,
  });
}

export async function countPendingBeneficiaryApprovals(query?: { search?: string }) {
  await requireAdmin();
  return prisma.beneficiary.count({ where: pendingBeneficiaryApprovalsWhere(query) });
}

/**
 * Moves a beneficiary to a different member's policy — a successor/deceased-
 * handling tool, only usable once the beneficiary's current member is
 * DECEASED (that member's own policy has already been settled, so their
 * beneficiaries need a new home). The reference number is regenerated under
 * the new member for consistency going forward (old printed references would
 * otherwise no longer match).
 */
export async function reallocateBeneficiary(beneficiaryId: string, newMemberId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "SECRETARY");

    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId }, include: { member: true } });
    if (beneficiary.member.status !== "DECEASED") {
      return { ok: false, error: "Beneficiaries can only be reallocated once the current member is deceased." };
    }
    if (newMemberId === beneficiary.memberId) {
      return { ok: false, error: "Select a different member to reallocate to." };
    }

    const newMember = await prisma.member.findUniqueOrThrow({ where: { id: newMemberId } });
    if (newMember.status === "DECEASED") {
      return { ok: false, error: "Cannot reallocate a beneficiary to a member who is also recorded as deceased." };
    }

    if (beneficiary.relationship === "FATHER" || beneficiary.relationship === "MOTHER") {
      await assertSingleParentSlotAvailable(newMemberId, beneficiary.relationship);
    }

    const referenceNo = await generateBeneficiaryReference(newMember.membershipNo, newMemberId);

    await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: { memberId: newMemberId, referenceNo },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiaryId,
      memberId: newMemberId,
      action: "UPDATE",
      performedByUserId: session.user.id,
      metadata: { reallocatedFrom: beneficiary.memberId, reallocatedTo: newMemberId },
    });

    revalidatePath(`/admin/members/${beneficiary.memberId}`);
    revalidatePath(`/admin/members/${beneficiary.memberId}/beneficiaries`);
    revalidatePath(`/admin/members/${newMemberId}`);
    revalidatePath(`/admin/members/${newMemberId}/beneficiaries`);
    return { ok: true, data: { id: beneficiaryId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to reallocate beneficiary.") };
  }
}

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function createBeneficiaryForm(formData: FormData) {
  return createBeneficiary(formDataToObject(formData));
}

export async function deleteBeneficiaryForm(formData: FormData) {
  return deleteBeneficiary(String(formData.get("beneficiaryId") ?? ""));
}

export async function cancelBeneficiaryForm(formData: FormData) {
  return cancelBeneficiary(String(formData.get("beneficiaryId") ?? ""));
}

export async function reviewBeneficiaryForm(formData: FormData) {
  return reviewBeneficiary(formDataToObject(formData));
}

export async function updateBeneficiaryForm(formData: FormData) {
  const obj = formDataToObject(formData);
  const beneficiaryId = String(obj.beneficiaryId ?? "");
  delete obj.beneficiaryId;
  return updateBeneficiary(beneficiaryId, obj);
}

export async function updateBeneficiaryStatusForm(formData: FormData) {
  return updateBeneficiaryStatus(
    String(formData.get("beneficiaryId") ?? ""),
    String(formData.get("status") ?? "") as BeneficiaryStatus
  );
}

export async function reallocateBeneficiaryForm(formData: FormData) {
  return reallocateBeneficiary(
    String(formData.get("beneficiaryId") ?? ""),
    String(formData.get("newMemberId") ?? "")
  );
}
