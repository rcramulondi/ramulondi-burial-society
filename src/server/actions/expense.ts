"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/permissions";
import { uploadPrivateFile } from "@/lib/storage/blob";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import { z } from "zod";
import type { ActionResult } from "./member";
import type { CommitteeRole } from "@prisma/client";

const expenseCreateSchema = z.object({
  description: z.string().trim().min(1, "Description is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  expenseDate: z.coerce.date(),
  spentByMemberId: z.string().min(1, "Select who spent the money."),
  approvedByRole: z.enum(["CHAIRPERSON", "VICE_CHAIR", "SECRETARY", "TREASURER", "ADDITIONAL_MEMBER"]),
  notes: z.string().trim().optional(),
});

/**
 * Unlike every other upload in this app, the receipt/slip is compulsory —
 * it's accepted in the SAME submission as the expense row (not a separate
 * follow-up upload step) so an Expense can never exist without one.
 */
export async function createExpense(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "A receipt or slip is required for every expense." };
    }

    const parsed = expenseCreateSchema.safeParse({
      description: formData.get("description"),
      amount: formData.get("amount"),
      expenseDate: formData.get("expenseDate"),
      spentByMemberId: formData.get("spentByMemberId"),
      approvedByRole: formData.get("approvedByRole"),
      notes: formData.get("notes") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const uploaded = await uploadPrivateFile(file, "expenses");

    const expense = await prisma.$transaction(async (tx) => {
      const e = await tx.expense.create({
        data: {
          description: data.description,
          amount: data.amount,
          expenseDate: data.expenseDate,
          spentByMemberId: data.spentByMemberId,
          approvedByRole: data.approvedByRole,
          approvedByUserId: session.user.id,
          notes: data.notes,
        },
      });
      await tx.document.create({
        data: {
          ownerType: "EXPENSE_PROOF",
          expenseId: e.id,
          storageKey: uploaded.storageKey,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          uploadedByUserId: session.user.id,
        },
      });
      return e;
    });

    await logAudit({
      entityType: "Expense",
      entityId: expense.id,
      memberId: data.spentByMemberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { amount: data.amount, approvedByRole: data.approvedByRole },
    });

    revalidatePath("/admin/expenses");
    return { ok: true, data: { id: expense.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to record expense.") };
  }
}

export async function listExpenses() {
  await requireAdmin();
  return prisma.expense.findMany({
    include: { spentByMember: true, documents: true },
    orderBy: { expenseDate: "desc" },
  });
}

/** Members who currently hold, or have ever held, a committee position. */
export async function listCommitteeEligibleMembers() {
  await requireAdmin();
  const terms = await prisma.committeeTerm.findMany({ include: { member: true } });
  const seen = new Map<string, (typeof terms)[number]["member"]>();
  for (const t of terms) seen.set(t.memberId, t.member);
  return Array.from(seen.values()).sort((a, b) => a.surname.localeCompare(b.surname));
}

/** The committee role currently held by this member, if any — used to auto-fill "approved by". */
export async function resolveApprovingCommitteeRole(memberId: string | null | undefined): Promise<CommitteeRole | null> {
  await requireAdmin();
  if (!memberId) return null;
  const term = await prisma.committeeTerm.findFirst({ where: { memberId, endDate: null } });
  return term?.role ?? null;
}
