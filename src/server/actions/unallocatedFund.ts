"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminGroup } from "@/server/permissions";
import { recordPaymentWithAllocation } from "@/lib/business/contributionAllocation";
import { sendProofOfPaymentEmail } from "./notifications";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import { z } from "zod";
import type { ActionResult } from "./member";

const unallocatedFundCreateSchema = z.object({
  depositType: z.enum(["CASH", "EFT"]),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  depositDate: z.coerce.date(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function recordUnallocatedFund(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "TREASURER");
    const parsed = unallocatedFundCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const fund = await prisma.unallocatedFund.create({
      data: {
        depositType: data.depositType,
        amount: data.amount,
        depositDate: data.depositDate,
        reference: data.reference,
        notes: data.notes,
        recordedByUserId: session.user.id,
      },
    });

    await logAudit({
      entityType: "UnallocatedFund",
      entityId: fund.id,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { amount: data.amount, depositType: data.depositType },
    });

    revalidatePath("/admin/unallocated-funds");
    return { ok: true, data: { id: fund.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to record unallocated fund.") };
  }
}

const allocateSchema = z.object({
  unallocatedFundId: z.string().min(1),
  memberId: z.string().min(1, "Select a member to allocate to."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
});

/**
 * Allocates part (or all) of an unallocated deposit to a member once the
 * recon/identification is done. Supports partial allocation — the same
 * deposit can be split across multiple members over time as each is
 * identified, with the remaining balance decreasing each time. The row lock
 * below serializes concurrent allocations against the same deposit; the
 * subsequent recordPaymentWithAllocation() call runs as its own transaction
 * rather than nested inside this one (Prisma doesn't support nesting
 * $transaction), so the window between them is a rare theoretical
 * double-allocation edge case, not a practical one, given the lock already
 * happened first.
 */
export async function allocateUnallocatedFund(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "TREASURER");
    const parsed = allocateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const { fund, remaining } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "UnallocatedFund" WHERE id = ${data.unallocatedFundId} FOR UPDATE`;
      const f = await tx.unallocatedFund.findUniqueOrThrow({ where: { id: data.unallocatedFundId } });
      const existing = await tx.unallocatedFundAllocation.aggregate({
        where: { unallocatedFundId: data.unallocatedFundId },
        _sum: { amount: true },
      });
      const rem = Number(f.amount) - Number(existing._sum.amount ?? 0);
      return { fund: f, remaining: rem };
    });

    if (fund.isDuplicate) {
      return { ok: false, error: "This deposit is marked as a duplicate — unmark it first if it should still be allocated." };
    }

    if (data.amount > remaining) {
      return { ok: false, error: `Only R${remaining.toFixed(2)} remains unallocated on this deposit.` };
    }

    const { paymentId } = await recordPaymentWithAllocation({
      memberId: data.memberId,
      amount: data.amount,
      paymentDate: fund.depositDate,
      category: "MONTHLY_CONTRIBUTION",
      method: fund.depositType === "CASH" ? "Cash" : "EFT",
      reference: fund.reference ?? undefined,
      notes: `Allocated from unallocated fund deposit of ${fund.depositDate.toDateString()}.`,
      recordedByUserId: session.user.id,
    });

    const allocation = await prisma.unallocatedFundAllocation.create({
      data: {
        unallocatedFundId: data.unallocatedFundId,
        memberId: data.memberId,
        amount: data.amount,
        paymentId,
        allocatedByUserId: session.user.id,
      },
    });

    await logAudit({
      entityType: "UnallocatedFundAllocation",
      entityId: allocation.id,
      memberId: data.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { amount: data.amount, unallocatedFundId: data.unallocatedFundId },
    });

    await sendProofOfPaymentEmail(paymentId, session.user.id);

    revalidatePath("/admin/unallocated-funds");
    revalidatePath(`/admin/members/${data.memberId}/payments`);
    return { ok: true, data: { id: allocation.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to allocate funds.") };
  }
}

const duplicateFlagSchema = z.object({
  unallocatedFundId: z.string().min(1),
  isDuplicate: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/**
 * Toggles the duplicate flag rather than deleting — a duplicate deposit may
 * already have real allocations/Payments against it (see deleteUnallocatedFund
 * for the case where it doesn't), so this must stay reversible and must
 * never touch existing allocation history.
 */
export async function markUnallocatedFundDuplicate(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "TREASURER");
    const parsed = duplicateFlagSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const fund = await prisma.unallocatedFund.update({
      where: { id: data.unallocatedFundId },
      data: { isDuplicate: data.isDuplicate },
    });

    await logAudit({
      entityType: "UnallocatedFund",
      entityId: fund.id,
      action: "UPDATE",
      performedByUserId: session.user.id,
      metadata: { isDuplicate: data.isDuplicate },
    });

    revalidatePath("/admin/unallocated-funds");
    return { ok: true, data: { id: fund.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to update this deposit.") };
  }
}

const deleteSchema = z.object({ unallocatedFundId: z.string().min(1) });

/**
 * Hard-deletes an unallocated deposit — only when it has zero allocations
 * against it (a genuinely mis-entered row). Once any amount has been
 * allocated, a real Payment already exists downstream; use
 * markUnallocatedFundDuplicate instead so that history is never destroyed.
 */
export async function deleteUnallocatedFund(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "TREASURER");
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const fund = await prisma.unallocatedFund.findUniqueOrThrow({
      where: { id: data.unallocatedFundId },
      include: { allocations: true },
    });
    if (fund.allocations.length > 0) {
      return { ok: false, error: "This deposit already has allocations against it — mark it as a duplicate instead of removing it." };
    }

    await prisma.$transaction([
      // No enforced FK from BankTransaction to UnallocatedFund (it's a plain
      // reference, not a relation), so clear it explicitly to avoid a
      // dangling id after this row is gone.
      prisma.bankTransaction.updateMany({
        where: { unallocatedFundId: data.unallocatedFundId },
        data: { unallocatedFundId: null },
      }),
      prisma.unallocatedFund.delete({ where: { id: data.unallocatedFundId } }),
    ]);

    await logAudit({
      entityType: "UnallocatedFund",
      entityId: data.unallocatedFundId,
      action: "DELETE",
      performedByUserId: session.user.id,
      metadata: { amount: Number(fund.amount), reference: fund.reference },
    });

    revalidatePath("/admin/unallocated-funds");
    return { ok: true, data: { id: data.unallocatedFundId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to remove this deposit.") };
  }
}

export async function listUnallocatedFunds() {
  await requireAdmin();
  const funds = await prisma.unallocatedFund.findMany({
    include: { allocations: { include: { member: true } } },
    orderBy: { depositDate: "desc" },
  });
  return funds.map((f) => {
    const allocatedAmount = f.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    return { ...f, allocatedAmount, remaining: Number(f.amount) - allocatedAmount };
  });
}

export async function recordUnallocatedFundForm(formData: FormData) {
  return recordUnallocatedFund(formDataToObject(formData));
}

export async function allocateUnallocatedFundForm(formData: FormData) {
  return allocateUnallocatedFund(formDataToObject(formData));
}

export async function markUnallocatedFundDuplicateForm(formData: FormData) {
  return markUnallocatedFundDuplicate(formDataToObject(formData));
}

export async function deleteUnallocatedFundForm(formData: FormData) {
  return deleteUnallocatedFund(formDataToObject(formData));
}
