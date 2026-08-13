"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminGroup } from "@/server/permissions";
import { refreshMemberStatus } from "@/lib/business/memberStatus";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import { DEFAULT_PAGE_SIZE, paginationSkip } from "@/lib/pagination";
import type { AdminGroup } from "@prisma/client";
import type { ActionResult } from "./member";

const MANAGE_USERS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

/**
 * Mirrors src/lib/accountStatus.ts's derivation as a Prisma `where`, so
 * status filtering happens at the DB level instead of in-memory.
 */
function manageUsersWhere(query?: { search?: string; role?: string; status?: string }) {
  const now = new Date();

  const searchFilter = query?.search
    ? {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" as const } },
          { surname: { contains: query.search, mode: "insensitive" as const } },
          { membershipNo: { contains: query.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const roleFilter = !query?.role
    ? {}
    : query.role === "MEMBER"
      ? { OR: [{ user: { is: null } }, { user: { is: { role: "MEMBER" as const } } }] }
      : { user: { is: { role: "ADMIN" as const, adminGroup: query.role as AdminGroup } } };

  const statusFilter =
    query?.status === "No account"
      ? { user: { is: null } }
      : query?.status === "Disabled"
        ? { user: { is: { disabled: true } } }
        : query?.status === "Locked"
          ? { user: { is: { disabled: false, lockedUntil: { gt: now } } } }
          : query?.status === "Active"
            ? { user: { is: { disabled: false, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] } } }
            : {};

  return { AND: [searchFilter, roleFilter, statusFilter] };
}

/**
 * Every member's account status, admin assignment, and current committee
 * position — powers the Manage Users screen. Committee position is shown as
 * informational context only; it has no bearing on admin eligibility (admin
 * roles are entirely independent of committee membership). Committee terms
 * are looked up only for the current page's members, not the whole roster.
 */
export async function listManageableUsers(query?: { search?: string; role?: string; status?: string; page?: number }) {
  await requireAdminGroup("SUPER_ADMIN");
  const page = Math.max(1, query?.page ?? 1);
  const where = manageUsersWhere(query);

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { user: true },
      orderBy: [{ surname: "asc" }, { id: "asc" }],
      skip: paginationSkip(page, MANAGE_USERS_PAGE_SIZE),
      take: MANAGE_USERS_PAGE_SIZE,
    }),
    prisma.member.count({ where }),
  ]);

  const activeTerms = await prisma.committeeTerm.findMany({
    where: { endDate: null, memberId: { in: members.map((m) => m.id) } },
  });
  const termByMember = new Map(activeTerms.map((t) => [t.memberId, t]));

  const users = members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    surname: m.surname,
    membershipNo: m.membershipNo,
    status: m.status,
    user: m.user,
    committeeRole: termByMember.get(m.id)?.role ?? null,
  }));

  return { users, total, page, pageSize: MANAGE_USERS_PAGE_SIZE };
}

/**
 * Reinstates a lapsed (IN_ACTIVE) member so they become eligible for account
 * access again — matches the same `reinstatementDate` mechanism the status
 * derivation already understands (memberStatus.ts uses it as the new
 * "start" date for arrears calculations).
 */
export async function reactivateMember(memberId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN");
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });

    if (member.status !== "IN_ACTIVE") {
      return { ok: false, error: "Only inactive (lapsed) members can be reactivated." };
    }

    await prisma.member.update({ where: { id: memberId }, data: { reinstatementDate: new Date() } });
    const result = await refreshMemberStatus(memberId);

    await logAudit({
      entityType: "Member",
      entityId: memberId,
      memberId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { reactivated: true, newStatus: result.status },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath("/admin/members");
    return { ok: true, data: { id: memberId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to reactivate member.") };
  }
}

export async function revokeAdminAccess(memberId: string): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN");
    const user = await prisma.user.findUniqueOrThrow({ where: { memberId } });

    if (user.adminGroup === "SUPER_ADMIN") {
      const otherSuperAdmins = await prisma.user.count({ where: { adminGroup: "SUPER_ADMIN", id: { not: user.id } } });
      if (otherSuperAdmins === 0) {
        return { ok: false, error: "At least one Super Admin account must remain — assign another Super Admin first." };
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { role: "MEMBER", adminGroup: null } });

    await logAudit({
      entityType: "User",
      entityId: user.id,
      memberId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { revokedGroup: user.adminGroup },
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { userId: user.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to revoke admin access.") };
  }
}

export async function unlockUserAccount(userId: string): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN");
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil: null, failedLoginCount: 0 } });

    await logAudit({
      entityType: "User",
      entityId: userId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { unlocked: true },
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { userId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to unlock account.") };
  }
}

export async function toggleUserDisabled(userId: string, disabled: boolean, reason?: string): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN");
    await prisma.user.update({
      where: { id: userId },
      data: { disabled, disabledReason: disabled ? (reason ?? "Manually disabled.") : null },
    });

    await logAudit({
      entityType: "User",
      entityId: userId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { disabled, reason },
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { userId } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to update account status.") };
  }
}

// --- FormData wrappers, for direct use with <ActionForm> ---

export async function reactivateMemberForm(formData: FormData) {
  return reactivateMember(String(formData.get("memberId") ?? ""));
}

export async function revokeAdminAccessForm(formData: FormData) {
  return revokeAdminAccess(String(formData.get("memberId") ?? ""));
}

export async function unlockUserAccountForm(formData: FormData) {
  return unlockUserAccount(String(formData.get("userId") ?? ""));
}

export async function toggleUserDisabledForm(formData: FormData) {
  return toggleUserDisabled(
    String(formData.get("userId") ?? ""),
    formData.get("disabled") === "true",
    String(formData.get("reason") ?? "") || undefined
  );
}
