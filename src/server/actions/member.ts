"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminGroup, requireMemberMaintainer, requireOwnMemberOrAdmin } from "@/server/permissions";
import { memberCreateSchema, memberUpdateSchema, memberDraftCreateSchema } from "@/lib/validation/schemas";
import { generateMembershipNumber } from "@/lib/business/membershipNumber";
import { refreshMemberStatus } from "@/lib/business/memberStatus";
import { getCurrentYearMemberFigures } from "@/lib/business/contributionAllocation";
import { assertSuccessionTarget } from "@/lib/business/memberRules";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createMember(input: unknown): Promise<ActionResult<{ id: string; membershipNo: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "SECRETARY");
    const parsed = memberCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    if (data.succeedsMemberId) {
      await assertSuccessionTarget(data.succeedsMemberId);
    }

    const membershipNo = await generateMembershipNumber(data.surname);

    const member = await prisma.member.create({
      data: {
        membershipNo,
        firstName: data.firstName,
        surname: data.surname,
        gender: data.gender,
        type: data.type,
        idNumber: data.idNumber,
        phone: data.phone,
        email: data.email,
        dateJoined: data.dateJoined,
        packageNote: data.packageNote,
        succeedsMemberId: data.succeedsMemberId,
      },
    });

    await refreshMemberStatus(member.id);
    await logAudit({
      entityType: "Member",
      entityId: member.id,
      memberId: member.id,
      action: "CREATE",
      performedByUserId: session.user.id,
    });

    revalidatePath("/admin/members");
    return { ok: true, data: { id: member.id, membershipNo: member.membershipNo } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to create member.") };
  }
}

/**
 * "Save as draft" on the Add Member wizard — relaxed validation (only name/
 * gender/type required), no succession/status-refresh side effects since a
 * barely-filled draft doesn't need real business-logic to run against it yet.
 * The membership number is still generated eagerly (same as a full create)
 * so nothing downstream ever has to special-case a member with no number.
 */
export async function createMemberDraft(input: unknown): Promise<ActionResult<{ id: string; membershipNo: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "SECRETARY");
    const parsed = memberDraftCreateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    const membershipNo = await generateMembershipNumber(data.surname);

    const member = await prisma.member.create({
      data: {
        membershipNo,
        firstName: data.firstName,
        surname: data.surname,
        gender: data.gender,
        type: data.type,
        idNumber: data.idNumber,
        phone: data.phone,
        email: data.email,
        dateJoined: data.dateJoined ?? new Date(),
        packageNote: data.packageNote,
        succeedsMemberId: data.succeedsMemberId,
        isDraft: true,
      },
    });

    await logAudit({
      entityType: "Member",
      entityId: member.id,
      memberId: member.id,
      action: "CREATE",
      performedByUserId: session.user.id,
      metadata: { draft: true },
    });

    revalidatePath("/admin/members");
    return { ok: true, data: { id: member.id, membershipNo: member.membershipNo } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to save draft.") };
  }
}

/**
 * Marks a draft complete — no re-validation beyond what's already stored;
 * the admin is expected to have used the normal Member Details edit form to
 * fill in anything missing first. Runs a status refresh once, since a
 * completed member should get a real status computed against it going
 * forward (a draft never had one run).
 */
export async function completeMemberDraft(memberId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN", "SECRETARY");
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

    if (!member.isDraft) {
      return { ok: false, error: "This member is not a draft." };
    }

    await prisma.member.update({ where: { id: memberId }, data: { isDraft: false } });
    await refreshMemberStatus(memberId);

    await logAudit({
      entityType: "Member",
      entityId: memberId,
      memberId,
      action: "UPDATE",
      performedByUserId: session.user.id,
      metadata: { draftCompleted: true },
    });

    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${memberId}`);
    return { ok: true, data: { id: memberId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to complete draft.") };
  }
}

export async function updateMember(memberId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireMemberMaintainer(memberId);

    const existing = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    if (existing.status === "DECEASED") {
      return { ok: false, error: "This member is recorded as deceased and their record can no longer be edited." };
    }

    const parsed = memberUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
    }
    const data = parsed.data;

    // Only admins can change type/dateJoined/idNumber-affecting fields that alter
    // contribution history or eligibility; members may only touch contact details.
    const memberEditableFields: Record<string, unknown> = {
      phone: data.phone,
      email: data.email,
    };
    const adminOnlyFields: Record<string, unknown> = {
      firstName: data.firstName,
      surname: data.surname,
      gender: data.gender,
      type: data.type,
      idNumber: data.idNumber,
      dateJoined: data.dateJoined,
      packageNote: data.packageNote,
      deceasedDate: data.deceasedDate,
    };

    const updateData = session.user.role === "ADMIN"
      ? { ...memberEditableFields, ...adminOnlyFields }
      : memberEditableFields;

    const cleanedUpdate = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    );

    const member = await prisma.member.update({ where: { id: memberId }, data: cleanedUpdate });

    if ("deceasedDate" in cleanedUpdate) {
      await refreshMemberStatus(member.id);
    }

    await logAudit({
      entityType: "Member",
      entityId: member.id,
      memberId: member.id,
      action: "UPDATE",
      performedByUserId: session.user.id,
      metadata: cleanedUpdate as Record<string, unknown>,
    });

    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath("/profile");
    return { ok: true, data: { id: member.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to update member.") };
  }
}

const MEMBERS_PAGE_SIZE = 20;

function membersWhere(query?: { search?: string; status?: string }) {
  // "DRAFT" is a pseudo-status (not a real MemberStatus) — a draft member's
  // `status` column still holds whatever the model default is, since status
  // derivation doesn't run against barely-filled drafts. Filtering by any
  // real status therefore excludes drafts (their status field isn't
  // meaningful yet); filtering by "DRAFT" shows only drafts; no filter shows
  // everything, with drafts tagged separately in the UI.
  const statusFilter =
    query?.status === "DRAFT"
      ? { isDraft: true }
      : query?.status
        ? { status: query.status as never, isDraft: false }
        : {};

  return {
    AND: [
      query?.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { surname: { contains: query.search, mode: "insensitive" as const } },
              { membershipNo: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {},
      statusFilter,
    ],
  };
}

export async function listMembers(query?: { search?: string; status?: string; page?: number }) {
  await requireAdmin();
  const page = Math.max(1, query?.page ?? 1);
  return prisma.member.findMany({
    where: membersWhere(query),
    orderBy: [{ surname: "asc" }, { id: "asc" }],
    skip: (page - 1) * MEMBERS_PAGE_SIZE,
    take: MEMBERS_PAGE_SIZE,
  });
}

export async function countMembers(query?: { search?: string; status?: string }) {
  await requireAdmin();
  return prisma.member.count({ where: membersWhere(query) });
}

/**
 * Members list enriched with beneficiary count, current-year contributions,
 * current-year outstanding balance, and termination date (actual or, for
 * ABOUT_TO_LAPSE members, projected) — batched to a fixed number of DB round
 * trips regardless of list size (see getCurrentYearMemberFigures). Paginated
 * at MEMBERS_PAGE_SIZE per page.
 */
export async function listMembersWithSummary(query?: { search?: string; status?: string; page?: number }) {
  const [members, total] = await Promise.all([listMembers(query), countMembers(query)]);
  const memberIds = members.map((m) => m.id);

  const [figures, beneficiaryCounts, claimCounts] = await Promise.all([
    getCurrentYearMemberFigures(memberIds),
    prisma.beneficiary.groupBy({
      by: ["memberId"],
      where: { memberId: { in: memberIds }, deletedAt: null, status: { in: ["ACTIVE", "INACTIVE"] } },
      _count: true,
    }),
    prisma.claim.groupBy({
      by: ["memberId"],
      where: { memberId: { in: memberIds } },
      _count: true,
    }),
  ]);

  const beneficiaryCountByMember = new Map(beneficiaryCounts.map((b) => [b.memberId, b._count]));
  const claimCountByMember = new Map(claimCounts.map((c) => [c.memberId, c._count]));

  return {
    members: members.map((m) => {
      const f = figures.get(m.id);
      return {
        ...m,
        beneficiaryCount: beneficiaryCountByMember.get(m.id) ?? 0,
        claimsCount: claimCountByMember.get(m.id) ?? 0,
        contributionsThisYear: f?.contributionsThisYear ?? 0,
        outstandingThisYear: f?.outstandingThisYear ?? 0,
        terminationDate: f?.terminationDate ?? null,
        projectedTerminationDate: f?.projectedTerminationDate ?? null,
      };
    }),
    total,
    page: Math.max(1, query?.page ?? 1),
    pageSize: MEMBERS_PAGE_SIZE,
  };
}

export async function getMemberDetail(memberId: string) {
  await requireOwnMemberOrAdmin(memberId);
  return prisma.member.findUnique({
    where: { id: memberId },
    include: {
      beneficiaries: { where: { deletedAt: null } },
      payoutNominee: true,
      claims: { include: { payout: true, beneficiary: true } },
      documents: true,
      succeedsMember: true,
      succeededByMember: true,
    },
  });
}

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function createMemberForm(formData: FormData) {
  return createMember(formDataToObject(formData));
}

export async function createMemberDraftForm(formData: FormData) {
  return createMemberDraft(formDataToObject(formData));
}

export async function completeMemberDraftForm(formData: FormData) {
  return completeMemberDraft(String(formData.get("memberId") ?? ""));
}

export async function updateMemberForm(formData: FormData) {
  const obj = formDataToObject(formData);
  const memberId = String(obj.memberId ?? "");
  delete obj.memberId;
  return updateMember(memberId, obj);
}
