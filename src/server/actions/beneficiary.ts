"use server";

import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin } from "@/server/permissions";
import { beneficiaryCreateSchema } from "@/lib/validation/schemas";
import { generateBeneficiaryReference } from "@/lib/business/membershipNumber";
import {
  assertSingleParentSlotAvailable,
  assertDeletionAllowed,
  assertNotReRegisteringDeceased,
} from "@/lib/business/beneficiaryRules";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import { requireAdmin } from "@/server/permissions";
import type { BeneficiaryStatus, Prisma } from "@prisma/client";
import type { ActionResult } from "./member";

export async function createBeneficiary(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = beneficiaryCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;
    const session = await requireOwnMemberOrAdmin(data.memberId);

    if (data.relationship === "FATHER" || data.relationship === "MOTHER") {
      await assertSingleParentSlotAvailable(data.memberId, data.relationship);
    }
    await assertNotReRegisteringDeceased(data.idNumber);

    const member = await prisma.member.findUniqueOrThrow({ where: { id: data.memberId } });
    const referenceNo = await generateBeneficiaryReference(member.membershipNo, member.id);

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
      },
    });

    await logAudit({
      entityType: "Beneficiary",
      entityId: beneficiary.id,
      memberId: data.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
    });

    revalidatePath("/beneficiaries");
    revalidatePath(`/admin/members/${data.memberId}`);
    return { ok: true, data: { id: beneficiary.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to add beneficiary.") };
  }
}

export async function deleteBeneficiary(beneficiaryId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const beneficiary = await prisma.beneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } });
    const session = await requireOwnMemberOrAdmin(beneficiary.memberId);

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
    const session = await requireAdmin();
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

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function createBeneficiaryForm(formData: FormData) {
  return createBeneficiary(formDataToObject(formData));
}

export async function deleteBeneficiaryForm(formData: FormData) {
  return deleteBeneficiary(String(formData.get("beneficiaryId") ?? ""));
}

export async function updateBeneficiaryStatusForm(formData: FormData) {
  return updateBeneficiaryStatus(
    String(formData.get("beneficiaryId") ?? ""),
    String(formData.get("status") ?? "") as BeneficiaryStatus
  );
}
