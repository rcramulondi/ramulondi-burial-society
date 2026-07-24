import { prisma } from "../prisma";
import { logAudit } from "../audit";
import type { AdminGroup, CommitteeRole } from "@prisma/client";

/**
 * Which admin group a committee role entitles its holder to. Treasurer and
 * Secretary/Vice Secretary map to their own dedicated groups; every other
 * committee role (Chairperson, Vice Chairperson, Additional Member 1/2,
 * Youth Coordinator) defaults to the least-privileged, view-only group.
 */
export function eligibleAdminGroupForCommitteeRole(role: CommitteeRole): AdminGroup {
  if (role === "TREASURER") return "TREASURER";
  if (role === "SECRETARY" || role === "VICE_SECRETARY") return "SECRETARY";
  return "CHAIRPERSON";
}

/**
 * Nightly batch job (mirrors `refreshAllMemberStatuses`'s loop-and-persist
 * shape): demotes any non-Super-Admin whose committee term has ended, or
 * whose current term's role no longer maps to their assigned group, back to
 * plain member access. Super Admins are exempt — deliberately, so the
 * society always retains at least one account that can't be auto-locked out.
 */
export async function refreshAllAdminAccess(today: Date = new Date()): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", adminGroup: { not: "SUPER_ADMIN" }, memberId: { not: null } },
  });

  let revoked = 0;
  for (const admin of admins) {
    const activeTerm = await prisma.committeeTerm.findFirst({
      where: { memberId: admin.memberId!, endDate: null },
    });
    const stillEligible = activeTerm && eligibleAdminGroupForCommitteeRole(activeTerm.role) === admin.adminGroup;

    if (!stillEligible) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: "MEMBER", adminGroup: null },
      });
      await logAudit({
        entityType: "User",
        entityId: admin.id,
        memberId: admin.memberId,
        action: "STATUS_CHANGE",
        performedByUserId: admin.id,
        metadata: { reason: "Committee term ended or role no longer matches admin group", from: admin.adminGroup, to: null },
      });
      revoked++;
    }
  }

  return revoked;
}
