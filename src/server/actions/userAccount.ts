"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminGroup } from "@/server/permissions";
import { createUserSeededFromMember } from "./activation";
import { eligibleAdminGroupForCommitteeRole } from "@/lib/business/adminAccess";
import { COMMITTEE_ROLE_LABELS } from "@/lib/statusLabels";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { toSafeErrorMessage } from "@/lib/actionError";
import type { ActionResult } from "./member";
import type { AdminGroup } from "@prisma/client";

/** Every member's account status, admin assignment, and current committee position — powers the Manage Users screen. */
export async function listManageableUsers() {
  await requireAdminGroup("SUPER_ADMIN");

  const [members, activeTerms] = await Promise.all([
    prisma.member.findMany({
      include: { user: true },
      orderBy: { surname: "asc" },
    }),
    prisma.committeeTerm.findMany({ where: { endDate: null } }),
  ]);

  const termByMember = new Map(activeTerms.map((t) => [t.memberId, t]));

  return members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    surname: m.surname,
    membershipNo: m.membershipNo,
    status: m.status,
    user: m.user,
    committeeRole: termByMember.get(m.id)?.role ?? null,
  }));
}

export async function setAdminGroup(memberId: string, group: AdminGroup): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await requireAdminGroup("SUPER_ADMIN");
    const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, include: { user: true } });

    if (member.status === "DECEASED") {
      return { ok: false, error: "This member is recorded as deceased and cannot be granted admin access." };
    }

    if (group !== "SUPER_ADMIN") {
      const activeTerm = await prisma.committeeTerm.findFirst({ where: { memberId, endDate: null } });
      const eligibleGroup = activeTerm ? eligibleAdminGroupForCommitteeRole(activeTerm.role) : null;
      if (!activeTerm) {
        return { ok: false, error: "This member does not currently hold a committee position, so they cannot be assigned an admin group." };
      }
      if (eligibleGroup !== group) {
        return {
          ok: false,
          error: `${member.firstName} ${member.surname} holds ${COMMITTEE_ROLE_LABELS[activeTerm.role]}, which is only eligible for the ${eligibleGroup} group.`,
        };
      }
    }

    const user = member.user ?? (await createUserSeededFromMember(member));
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN", adminGroup: group },
    });

    await logAudit({
      entityType: "User",
      entityId: user.id,
      memberId,
      action: "STATUS_CHANGE",
      performedByUserId: session.user.id,
      metadata: { grantedGroup: group },
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { userId: user.id } };
  } catch (e) {
    return { ok: false, error: toSafeErrorMessage(e, "Failed to assign admin group.") };
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

export async function setAdminGroupForm(formData: FormData) {
  return setAdminGroup(String(formData.get("memberId") ?? ""), formData.get("group") as AdminGroup);
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
