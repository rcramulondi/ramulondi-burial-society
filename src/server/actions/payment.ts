"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireOwnMemberOrAdmin } from "@/server/permissions";
import { paymentCreateSchema } from "@/lib/validation/schemas";
import { recordPaymentWithAllocation, getOutstandingBalance } from "@/lib/business/contributionAllocation";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";
import type { Fund } from "@prisma/client";

export async function recordPayment(input: unknown): Promise<ActionResult<{ paymentId: string; unallocatedAmount: number }>> {
  try {
    const session = await requireAdmin();
    const parsed = paymentCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const result = await recordPaymentWithAllocation({
      memberId: data.memberId,
      amount: data.amount,
      paymentDate: data.paymentDate,
      category: data.category,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
      recordedByUserId: session.user.id,
    });

    await logAudit({
      entityType: "Payment",
      entityId: result.paymentId,
      memberId: data.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { amount: data.amount, category: data.category },
    });

    revalidatePath(`/admin/members/${data.memberId}`);
    revalidatePath("/contributions");
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to record payment.") };
  }
}

const rateCreateSchema = z.object({
  membershipType: z.enum(["MAIN", "KHADZI"]),
  fund: z.enum(["BURIAL", "FOOD"]),
  amount: z.coerce.number().positive(),
  effectiveFrom: z.coerce.date(),
});

export async function createContributionRate(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = rateCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    // Close off the previous open-ended rate for this type/fund, if any.
    await prisma.contributionRate.updateMany({
      where: { membershipType: data.membershipType, fund: data.fund, effectiveTo: null },
      data: { effectiveTo: data.effectiveFrom },
    });

    const rate = await prisma.contributionRate.create({
      data: {
        membershipType: data.membershipType,
        fund: data.fund,
        amount: data.amount,
        effectiveFrom: data.effectiveFrom,
        createdByUserId: session.user.id,
      },
    });

    revalidatePath("/admin/rates");
    return { ok: true, data: { id: rate.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to create rate.") };
  }
}

export async function listContributionRates() {
  await requireAdmin();
  return prisma.contributionRate.findMany({ orderBy: [{ membershipType: "asc" }, { fund: "asc" }, { effectiveFrom: "desc" }] });
}

export async function getMemberContributionSummary(memberId: string) {
  const [allocations, outstanding] = await Promise.all([
    prisma.paymentAllocation.findMany({ where: { memberId }, orderBy: [{ year: "asc" }, { month: "asc" }] }),
    getOutstandingBalance(memberId),
  ]);

  const byYear = new Map<number, { total: number; byFund: Record<Fund, number> }>();
  for (const a of allocations) {
    const entry = byYear.get(a.year) ?? { total: 0, byFund: { BURIAL: 0, FOOD: 0 } };
    entry.total += Number(a.amount);
    entry.byFund[a.fund] += Number(a.amount);
    byYear.set(a.year, entry);
  }

  return {
    outstandingBalance: outstanding,
    byYear: Array.from(byYear.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, v]) => ({ year, ...v })),
    allocations,
  };
}

/**
 * Recent payments across all members, for the Reports tab landing page.
 */
export async function listRecentPayments(query?: { search?: string }) {
  await requireAdmin();
  return prisma.payment.findMany({
    where: query?.search
      ? {
          member: {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { surname: { contains: query.search, mode: "insensitive" } },
              { membershipNo: { contains: query.search, mode: "insensitive" } },
            ],
          },
        }
      : undefined,
    orderBy: { paymentDate: "desc" },
    take: 50,
    include: { member: true },
  });
}

/**
 * Individual Payment transaction list for a member (as opposed to the
 * aggregated PaymentAllocation sums getMemberContributionSummary returns) —
 * powers the admin Payment History screen's transaction table.
 */
export async function listMemberPayments(memberId: string, options?: { year?: number }) {
  await requireOwnMemberOrAdmin(memberId);
  return prisma.payment.findMany({
    where: {
      memberId,
      ...(options?.year
        ? {
            paymentDate: {
              gte: new Date(Date.UTC(options.year, 0, 1)),
              lt: new Date(Date.UTC(options.year + 1, 0, 1)),
            },
          }
        : {}),
    },
    orderBy: { paymentDate: "desc" },
    include: { allocations: true, documents: true },
  });
}

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function recordPaymentForm(formData: FormData) {
  return recordPayment(formDataToObject(formData));
}

export async function createContributionRateForm(formData: FormData) {
  return createContributionRate(formDataToObject(formData));
}
