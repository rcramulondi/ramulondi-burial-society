"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminGroup } from "@/server/permissions";
import { refreshMemberStatus } from "@/lib/business/memberStatus";
import { accountStatus } from "@/lib/accountStatus";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";

const MANAGE_USERS_PAGE_SIZE = 10;

/**
 * Every member's account status, admin assignment, and current committee
 * position — powers the Manage Users screen. Committee position is shown as
 * informational context only; it has no bearing on admin eligibility (admin
 * roles are entirely independent of committee membership). Filters, then
 * paginates, in-memory: this app's membership is small enough (low hundreds)
 * that fetching the full list once per request and slicing is simpler than
 * building the equivalent relational Prisma `where` for a computed field
 * like account status (which depends on comparing `lockedUntil` to "now").
 */
export async function listManageableUsers(query?: { search?: string; role?: string; status?: string; page?: number }) {
  await requireAdminGroup("SUPER_ADMIN");

  const [members, activeTerms] = await Promise.all([
    prisma.member.findMany({
      include: { user: true },
      orderBy: { surname: "asc" },
    }),
    prisma.committeeTerm.findMany({ where: { endDate: null } }),
  ]);

  const termByMember = new Map(activeTerms.map((t) => [t.memberId, t]));

  let rows = members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    surname: m.surname,
    membershipNo: m.membershipNo,
    status: m.status,
    user: m.user,
    committeeRole: termByMember.get(m.id)?.role ?? null,
  }));

  if (query?.search) {
    const s = query.search.trim().toLowerCase();
    rows = rows.filter(
      (r) => `${r.firstName} ${r.surname}`.toLowerCase().includes(s) || r.membershipNo.toLowerCase().includes(s)
    );
  }
  if (query?.role) {
    rows = rows.filter((r) =>
      query.role === "MEMBER" ? r.user?.role !== "ADMIN" : r.user?.role === "ADMIN" && r.user.adminGroup === query.role
    );
  }
  if (query?.status) {
    rows = rows.filter((r) => accountStatus(r.user) === query.status);
  }

  const total = rows.length;
  const page = Math.max(1, query?.page ?? 1);
  const users = rows.slice((page - 1) * MANAGE_USERS_PAGE_SIZE, page * MANAGE_USERS_PAGE_SIZE);

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
