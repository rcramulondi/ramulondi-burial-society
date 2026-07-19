"use server";

import { prisma } from "@/lib/prisma";
import { requireOwnMemberOrAdmin } from "@/server/permissions";
import { payoutNomineeSchema } from "@/lib/validation/schemas";
import { logAudit } from "@/lib/audit";
import { formDataToObject } from "@/lib/formData";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

export async function upsertPayoutNominee(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = payoutNomineeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;
    const session = await requireOwnMemberOrAdmin(data.memberId);

    const nominee = await prisma.payoutNominee.upsert({
      where: { memberId: data.memberId },
      create: data,
      update: data,
    });

    await logAudit({
      entityType: "PayoutNominee",
      entityId: nominee.id,
      memberId: data.memberId,
      action: "UPDATE",
      performedByUserId: session.user.id,
    });

    revalidatePath("/profile");
    return { ok: true, data: { id: nominee.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to save nominee.") };
  }
}

export async function upsertPayoutNomineeForm(formData: FormData) {
  return upsertPayoutNominee(formDataToObject(formData));
}
