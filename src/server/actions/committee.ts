"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/server/permissions";
import { assertMemberEligibleForCommittee } from "@/lib/business/committeeRules";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";
import { z } from "zod";
import { CommitteeRole } from "@prisma/client";
import type { ActionResult } from "./member";

const assignCommitteeRoleSchema = z.object({
  role: z.nativeEnum(CommitteeRole),
  memberId: z.string().min(1),
  startDate: z.coerce.date(),
});

export async function assignCommitteeRole(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = assignCommitteeRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    await assertMemberEligibleForCommittee(data.memberId);

    const term = await prisma.$transaction(async (tx) => {
      // Ends the incumbent's term at the moment the new one starts — the
      // partial unique index on (role) WHERE endDate IS NULL is the
      // concurrency backstop under simultaneous writes.
      await tx.committeeTerm.updateMany({
        where: { role: data.role, endDate: null },
        data: { endDate: data.startDate },
      });
      return tx.committeeTerm.create({
        data: {
          role: data.role,
          memberId: data.memberId,
          startDate: data.startDate,
          createdByUserId: session.user.id,
        },
      });
    });

    await logAudit({
      entityType: "CommitteeTerm",
      entityId: term.id,
      memberId: data.memberId,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { role: data.role },
    });

    revalidatePath("/admin/committee");
    revalidatePath("/profile");
    return { ok: true, data: { id: term.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to assign committee role.") };
  }
}

/** Visible to any signed-in user (admin screen + member profile read-only view). */
export async function listCurrentCommitteeHolders() {
  await requireAuth();
  return prisma.committeeTerm.findMany({
    where: { endDate: null },
    include: { member: true },
  });
}

export async function listCommitteeHistory() {
  await requireAuth();
  return prisma.committeeTerm.findMany({
    include: { member: true },
    orderBy: { startDate: "desc" },
  });
}

export async function assignCommitteeRoleForm(formData: FormData) {
  return assignCommitteeRole(formDataToObject(formData));
}
