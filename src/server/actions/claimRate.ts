"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

const claimRateCreateSchema = z.object({
  type: z.enum(["BASE_PAYOUT", "ADDITIONAL_BURIAL_SITE"]),
  amount: z.coerce.number().positive(),
  effectiveFrom: z.coerce.date(),
});

export async function createClaimRate(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = claimRateCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    // Close off the previous open-ended rate for this type, if any.
    await prisma.claimRate.updateMany({
      where: { type: data.type, effectiveTo: null },
      data: { effectiveTo: data.effectiveFrom },
    });

    const rate = await prisma.claimRate.create({
      data: {
        type: data.type,
        amount: data.amount,
        effectiveFrom: data.effectiveFrom,
        createdByUserId: session.user.id,
      },
    });

    revalidatePath("/admin/rates");
    return { ok: true, data: { id: rate.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to create claim rate.") };
  }
}

export async function listClaimRates() {
  await requireAdmin();
  return prisma.claimRate.findMany({ orderBy: [{ type: "asc" }, { effectiveFrom: "desc" }] });
}

export async function createClaimRateForm(formData: FormData) {
  return createClaimRate(formDataToObject(formData));
}
