"use server";

import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin } from "@/server/permissions";
import { beneficiaryCreateSchema } from "@/lib/validation/schemas";
import { generateBeneficiaryReference } from "@/lib/business/membershipNumber";
import { assertSingleParentSlotAvailable, assertDeletionAllowed } from "@/lib/business/beneficiaryRules";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
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

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function createBeneficiaryForm(formData: FormData) {
  return createBeneficiary(formDataToObject(formData));
}

export async function deleteBeneficiaryForm(formData: FormData) {
  return deleteBeneficiary(String(formData.get("beneficiaryId") ?? ""));
}
