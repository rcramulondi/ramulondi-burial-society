"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireOwnMemberOrAdmin } from "@/server/permissions";
import { memberCreateSchema, memberUpdateSchema } from "@/lib/validation/schemas";
import { generateMembershipNumber } from "@/lib/business/membershipNumber";
import { refreshMemberStatus } from "@/lib/business/memberStatus";
import { getOutstandingBalancesForMembers } from "@/lib/business/contributionAllocation";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { formDataToObject } from "@/lib/formData";
import { toSafeErrorMessage } from "@/lib/actionError";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createMember(input: unknown): Promise<ActionResult<{ id: string; membershipNo: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = memberCreateSchema.safeParse(input);
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
        dateJoined: data.dateJoined,
        packageNote: data.packageNote,
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

export async function updateMember(memberId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireOwnMemberOrAdmin(memberId);

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
      query?.status ? { status: query.status as never } : {},
    ],
  };
}

export async function listMembers(query?: { search?: string; status?: string; page?: number }) {
  await requireAdmin();
  const page = Math.max(1, query?.page ?? 1);
  return prisma.member.findMany({
    where: membersWhere(query),
    orderBy: { surname: "asc" },
    skip: (page - 1) * MEMBERS_PAGE_SIZE,
    take: MEMBERS_PAGE_SIZE,
  });
}

export async function countMembers(query?: { search?: string; status?: string }) {
  await requireAdmin();
  return prisma.member.count({ where: membersWhere(query) });
}

/**
 * Members list enriched with beneficiary count, contributions-to-date, and
 * outstanding balance — batched to a fixed number of DB round trips
 * regardless of list size (see getOutstandingBalancesForMembers). Paginated
 * at MEMBERS_PAGE_SIZE per page.
 */
export async function listMembersWithSummary(query?: { search?: string; status?: string; page?: number }) {
  const [members, total] = await Promise.all([listMembers(query), countMembers(query)]);
  const memberIds = members.map((m) => m.id);

  const [balances, beneficiaryCounts] = await Promise.all([
    getOutstandingBalancesForMembers(memberIds),
    prisma.beneficiary.groupBy({
      by: ["memberId"],
      where: { memberId: { in: memberIds }, deletedAt: null, status: { in: ["ACTIVE", "INACTIVE"] } },
      _count: true,
    }),
  ]);

  const beneficiaryCountByMember = new Map(beneficiaryCounts.map((b) => [b.memberId, b._count]));

  return {
    members: members.map((m) => ({
      ...m,
      beneficiaryCount: beneficiaryCountByMember.get(m.id) ?? 0,
      contributionsToDate: balances.get(m.id)?.contributionsToDate ?? 0,
      outstandingBalance: balances.get(m.id)?.outstandingBalance ?? 0,
    })),
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
    },
  });
}

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function createMemberForm(formData: FormData) {
  return createMember(formDataToObject(formData));
}

export async function updateMemberForm(formData: FormData) {
  const obj = formDataToObject(formData);
  const memberId = String(obj.memberId ?? "");
  delete obj.memberId;
  return updateMember(memberId, obj);
}
